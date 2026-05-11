const amqp = require('amqplib')
const mongoose = require('mongoose')
const Minio = require('minio')
const fs = require('fs')
const path = require('path')
const Job = require('./models/Job.js')
const processors = require('./processor.js')



const minioClient = new Minio.Client({
    endPoint: process.env.MINIO_ENDPOINT || 'minio',
    port: 9000,
    useSSL: false,
    accessKey: process.env.MINIO_ACCESS_KEY || 'admin',
    secretKey: process.env.MINIO_SECRET_KEY || 'password123'
})


let lastUpdate = 0



const updateProgress = async (jobId, progress) => {
    if (progress - lastUpdate >= 1 || progress >= 95 || progress == 100) {
        lastUpdate = progress
        console.log(`[Job ${jobId}] Progress: ${progress}`)
        await Job.findByIdAndUpdate(jobId, { progress: progress })

    }
}


let currentJobId = null;
let activeAbortHandler = null;

async function start() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const conn = await amqp.connect(process.env.RABBITMQ_URL);
        const channel = await conn.createChannel();

        console.log(`Connected to DB: ${mongoose.connection.name}`);

        // 1. SETUP CONTROL EXCHANGE (FANOUT)
        const controlExchange = 'control_exchange';
        await channel.assertExchange(controlExchange, 'fanout', { durable: false });

        // Kreiramo unikatan privremeni red za ovog vokera
        const q = await channel.assertQueue('', { exclusive: true });
        await channel.bindQueue(q.queue, controlExchange, '');

        // Slušamo komande za prekid
        channel.consume(q.queue, (msg) => {
            if (!msg) return;
            const data = JSON.parse(msg.content.toString());

            if (data.action === 'ABORT' && data.jobId === currentJobId) {
                console.log(`[CONTROL] Abort signal received for Job ${data.jobId}`);
                if (activeAbortHandler) {
                    activeAbortHandler(); // Poziva .kill() unutar procesora
                }
            }
        }, { noAck: true });

        // 2. STANDARDNI POSAO (DIRECT QUEUE)
        await channel.assertQueue(process.env.QUEUE_NAME, { durable: true });
        channel.prefetch(1);

        console.log(`[*] Worker started. Listening to: ${process.env.QUEUE_NAME}`);

        channel.consume(process.env.QUEUE_NAME, async (msg) => {
            if (!msg) return;

            const { jobId, fileNames, fileName, type, options } = JSON.parse(msg.content.toString());
            currentJobId = jobId; 
            lastUpdate = 0; // Reset progress for the new job

            const targets = fileNames || fileName;
            const localPaths = [];

            try {
                console.log(`[Job ${jobId}] Accepted: ${type}`);
                await Job.findByIdAndUpdate(jobId, { status: 'PROCESSING' });

                // Download faza (0-20%)
                for (let i = 0; i < targets.length; i++) {
                    const fName = targets[i];
                    const localPath = `/tmp/${fName}`;
                    await minioClient.fGetObject('multimedia', fName, localPath);
                    localPaths.push(localPath);

                    const dProgress = Math.round(((i + 1) / targets.length) * 20);
                    await updateProgress(jobId, dProgress);
                }

                const processorInput = (type === 'OCR_DOCUMENT') ? localPaths : localPaths[0];

                // --- POZIV PROCESORA SA ABORT LOGIKOM ---
                const processing = processors[type](processorInput, jobId, async (p) => {
                    await updateProgress(jobId, p);
                }, options);

                activeAbortHandler = processing.abort; // Čuvamo referencu za prekid

                // Čekamo završetak (20-80%)
                const resultPaths = await processing.promise;
                // ----------------------------------------

                const outputUrls = [];
                // Upload faza (80-100%)
                for (let i = 0; i < resultPaths.length; i++) {
                    const localResult = resultPaths[i];
                    if (fs.existsSync(localResult)) {
                        const s3Name = `results/${path.basename(localResult)}`;
                        const stepStart = 80 + (i / resultPaths.length) * 20;
                        await updateProgress(jobId, Math.round(stepStart));

                        await minioClient.fPutObject('multimedia', s3Name, localResult);
                        outputUrls.push(s3Name);

                        const stepEnd = 80 + ((i + 1) / resultPaths.length) * 20;
                        await updateProgress(jobId, Math.round(stepEnd));

                        fs.unlinkSync(localResult); // Brišemo lokalni rezultat odmah
                    }
                }

                console.log(`[Job ${jobId}] Cleaning up original files from S3...`);
                await minioClient.removeObjects('multimedia', targets);

                await Job.findByIdAndUpdate(jobId, { status: 'COMPLETED', outputUrls: outputUrls, progress: 100 });
                console.log(`[Job ${jobId}] Finished successfully.`);
                channel.ack(msg);

            } catch (error) {
                if (error.message === 'ABORTED') {
                    console.warn(`[Job ${jobId}] Job was aborted by user.`);
                    // Status je već ABORTED u bazi (postavio ga je API), ne prepisujemo ga sa FAILED
                } else {
                    console.error(`[Job ${jobId}] ERROR: `, error.message);
                    await Job.findByIdAndUpdate(jobId, { status: 'FAILED', error: error.message });
                }
                channel.ack(msg); // Ack-ujemo da bi poruka nestala iz reda
            } finally {
                // Totalni cleanup lokalnih fajlova
                localPaths.forEach(p => { if (fs.existsSync(p)) fs.unlinkSync(p); });
                currentJobId = null;
                activeAbortHandler = null;
            }
        });

    } catch (error) {
        console.error('Worker connection error: ', error);
        setTimeout(start, 5000);
    }
}
start()
