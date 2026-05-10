require('dotenv').config()


const express = require('express')
const mongoose = require('mongoose')
const Minio = require('minio')
const amqp = require('amqplib')
const multer = require('multer')
const http = require('http')
const { Server } = require('socket.io')
const cors = require('cors')
const path = require('path')
const archiver = require('archiver')
const passport = require('passport')
const GoogleStrategy = require('passport-google-oauth20').Strategy
const session = require('express-session')
const LocalStrategy = require('passport-local').Strategy


const Job = require('./models/Job')
const User = require('./models/User')



const app = express()
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true
}))
app.use(express.json())


app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        secure: false,
        maxAge: 24 * 60 * 60 * 1000
    }
}))


app.use(passport.initialize())
app.use(passport.session())

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL
},
    async (accessToken, refreshToken, profile, done) => {

        const email = profile.emails[0].value
        try {
            let user = await User.findOne({ $or: [{ googleId: profile.id }, { email }] })
            if (user) {
                if (!user.googleId) {
                    user.googleId = profile.id
                    user.authMethod = 'google'
                    await user.save()

                }
                return done(null, user)
            } else {
                user = await User.create({
                    googleId: profile.id,
                    email: email,
                    displayName: profile.displayName,
                    image: profile.photos[0].value,
                    authMethod: 'google'
                })
                return done(null, user)
            }
        } catch (error) {
            return done(error, null)

        }
    }
))


passport.use(new LocalStrategy(
    { usernameField: 'email' },
    async (email, password, done) => {
        try {
            const user = await User.findOne({ email }).select('+password');

            if (!user) {
                return done(null, false, { message: 'Incorrect email.' });
            }

            if (!user.password) {
                return done(null, false, { message: 'Please log in with Google.' });
            }

            const isMatch = await user.comparePassword(password);
            if (!isMatch) {
                return done(null, false, { message: 'Incorrect password.' });
            }

            // 4. Success!
            return done(null, user);
        } catch (err) {
            return done(err);
        }
    }
));


const ensureAuthenticated = (req, res, next) => {
    if (req.isAuthenticated()) {
        return next();

    }
    res.status(401).json({
        success: false,
        message: "Unauthorized: Please log in to access this resource"

    });

};

passport.serializeUser((user, done) => done(null, user))
passport.deserializeUser((obj, done) => done(null, obj))

const server = http.createServer(app)
const io = new Server(server, {
    cors: { origin: "*" }
})


const upload = multer({ storage: multer.memoryStorage() })


const MONGO_URI = process.env.MONGO_URI
const RABBITMQ_URL = process.env.RABBITMQ_URL


const MINIO_CONFIG = {
    endPoint: process.env.MINIO_ENDPOINT,
    port: parseInt(process.env.MINIO_PORT),
    useSSL: false,
    accessKey: process.env.MINIO_ACCESS_KEY,
    secretKey: process.env.MINIO_SECRET_KEY
}


const minioClient = new Minio.Client(MINIO_CONFIG)
let channel

mongoose.connection.on('error', err => {
    console.error('MongoDB error: ', err)
})
mongoose.connection.on('disconnected', () => {
    console.log(' MongoDB disconnected. Retrying in 5s...');
    setTimeout(connectMongoDB, 5000);
});


function setupJobWatcher() {

    const changeStream = Job.watch()


    changeStream.on('change', (change) => {
        if (change.operationType === 'update') {
            const jobId = change.documentKey._id.toString()
            const updatedFields = change.updateDescription.updatedFields


            if (updatedFields.progress != undefined || updatedFields.status) {
                io.to(jobId).emit('job-update', {
                    jobId: jobId,
                    progress: updatedFields.progress,
                    status: updatedFields.status,
                    outputUrls: updatedFields.outputUrls,
                    error: updatedFields.error
                })
            }
        }
    })


    changeStream.on('error', (err) => {
        console.error('Change Stream Error: ', err.message)
        setTimeout(setupJobWatcher, 5000)
    })
}

async function connectMongoDB() {
    try {
        console.log(process.env.MONGO_URI)
        await mongoose.connect(MONGO_URI, {
            serverSelectionTimeoutMS: 10000,
            socketTimeoutMS: 45000,
            family: 4
        })

        console.log('MongoDB connected...')
        setupJobWatcher()
    } catch (error) {
        console.error('MongoDB error: ', error.message)
        setTimeout(connectMongoDB, 5000)
        return

    }
}


async function connectRabbitMQ() {
    try {

        const connection = await amqp.connect(RABBITMQ_URL)
        channel = await connection.createChannel()


        const exchangeName = 'multimedia_exchange'
        await channel.assertExchange(exchangeName, 'direct', { durable: true })
        await channel.assertQueue('video_thumbnails', { durable: true })
        await channel.assertQueue('video_resize', { durable: true })
        await channel.assertQueue('audio_extract', { durable: true })
        await channel.assertQueue('ocr_document', { durable: true })

        await channel.bindQueue('video_thumbnails', exchangeName, 'video.thumb')
        await channel.bindQueue('video_resize', exchangeName, 'video.resize')
        await channel.bindQueue('audio_extract', exchangeName, 'video.audio')
        await channel.bindQueue('ocr_document', exchangeName, 'doc.ocr')


        const controlExchange = 'control_exchange'
        await channel.assertExchange(controlExchange, 'fanout', { durable: false })


        console.log('RabbitMQ connected and queue created')

    } catch (error) {
        console.error('RabbitMQ error: ', error.message)
        setTimeout(connectRabbitMQ, 5000)
        return
    }
}

async function connectMinio() {
    try {
        const bucketExists = await minioClient.bucketExists('multimedia')
        if (!bucketExists) {
            await minioClient.makeBucket('multimedia')
            console.log('MinIO connected and bucket created')
        } else console.log('MinIO connected')

    } catch (error) {
        console.error('MinIO error: ', error.message)
        setTimeout(connectMinio, 5000)
        return
    }
}


async function init() {
    await connectMongoDB()
    await connectRabbitMQ()
    await connectMinio()
}


init()



io.on('connection', (socket) => {
    console.log('New client connected: ', socket.id)

    socket.on('join-job', (jobId) => {
        socket.join(jobId)
        console.log(`Client ${socket.id} joined room: ${jobId}`)
        Job.findById(jobId).then(job => {
            if (job) {
                socket.emit('job-update', {
                    jobId: job._id,
                    progress: job.progress,
                    status: job.status,
                    outputUrls: job.outputUrls
                });
            }
        });
    })
    socket.on('disconnect', () => {
        console.log('Client disconnected: ', socket.id)
    })
})

app.get('/health', (req, res) => {
    res.json({ status: 'API is up and running...' })
})


app.post('/upload/video', upload.single('file'), ensureAuthenticated, async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ success: false, message: 'No file attached!' })

        const { type, resolution } = req.body
        if (!['VIDEO_THUMBNAILS', 'AUDIO_EXTRACT', 'VIDEO_RESIZE', 'OCR_DOCUMENT'].includes(type)) {
            return res.status(400).json({ success: false, message: 'Invalid or no job type!' })
        }

        const objectName = `${Date.now()}-${req.file.originalname}`

        await minioClient.putObject('multimedia', objectName, req.file.buffer)

        const newJob = new Job({
            originalName: req.file.originalname,
            s3Keys: objectName,
            type: type,
            userId: req.user._id
        })
        try {
            await newJob.save()

        } catch (err) {
            console.log('job save error', err)
        }

        let routingKey
        switch (type) {
            case 'VIDEO_THUMBNAILS': routingKey = 'video.thumb'; break
            case 'VIDEO_RESIZE': routingKey = 'video.resize'; break
            case 'AUDIO_EXTRACT': routingKey = 'video.audio'; break
            case 'OCR_DOCUMENT': routingKey = 'doc.ocr'; break
            default: return res.status(400).json({ success: false, message: 'Invalid or no job type!' })
        }


        const message = {
            jobId: newJob._id,
            fileName: [objectName],
            status: 'PENDING',
            type: type,
            options: {
                resolution: type === 'VIDEO_RESIZE' ? (resolution || '480p') : null
            }
        }


        channel.publish('multimedia_exchange', routingKey, Buffer.from(JSON.stringify(message)), { persistent: true })



        res.json({ status: true, message: "File accepted and will start with work soon", jobId: newJob._id })

    } catch (error) {
        console.error(error)
        res.status(500).json({ success: false, message: "Server error!" })
    }
})


app.post('/upload/docs', upload.array('file', 10), ensureAuthenticated, async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ success: false, message: 'No images attached!' })
        }

        const uploadedObjects = []

        for (const file of req.files) {
            const objectName = `${Date.now()}-${file.originalname}`
            await minioClient.putObject('multimedia', objectName, file.buffer)
            uploadedObjects.push(objectName)
        }


        const newJob = new Job({
            originalName: `Batch of ${req.files.length} images`,
            s3Keys: uploadedObjects,
            type: 'OCR_DOCUMENT',
            userId: req.user._id
        })


        await newJob.save()


        const message = {
            jobId: newJob._id,
            fileNames: uploadedObjects,
            type: 'OCR_DOCUMENT',
            options: {}
        }


        channel.publish('multimedia_exchange', 'doc.ocr', Buffer.from(JSON.stringify(message)), { persistent: true })

        res.json({ status: true, message: "Files accepted and will start with work soon", jobId: newJob._id })
    } catch (error) {
        console.error(error)
        res.status(500).json({ success: false, message: "Server error!" })

    }
})



app.post('/jobs/abort/:jobId', async (req, res) => {
    try {
        const { jobId } = req.params



        await Job.findByIdAndUpdate(jobId, { status: 'ABORTED' })


        const abortMessage = { action: 'ABORT', jobId: jobId }
        channel.publish('control_exchange', '', Buffer.from(JSON.stringify(abortMessage)))

        res.json({ success: true, message: 'Abort signal sent!' })

    } catch (error) {
        res.status(500).send(error.message)

    }
})


app.get('/download/:jobId', async (req, res) => {
    try {
        const { jobId } = req.params

        const { fileUrl } = req.query
        if (!fileUrl) return res.status(400).json({ success: false, message: 'Missing file url!' })


        const job = await Job.findById(jobId)

        if (!job || job.status !== 'COMPLETED') {
            return res.status(404).json({ success: false, message: 'Not ready for download or does not exist!' })
        }

        const fileIndex = job.outputUrls.indexOf(fileUrl)

        if (fileIndex === -1) {
            return res.status(403).json({ success: false, message: 'File does not belong to this job!' })
        }


        const fileName = path.basename(fileUrl)
        const stat = await minioClient.statObject('multimedia', fileUrl)

        res.writeHead(200, {
            'content-type': stat.contentType || 'application/octet-stream',
            'content-length': stat.size,
            'content-disposition': `attachment; filename=${fileName}`
        })


        const dataStream = await minioClient.getObject('multimedia', fileUrl)
        dataStream.pipe(res)

        res.on('finish', async () => {
            await Job.findByIdAndUpdate(jobId, { $addToSet: { downloadedIndices: fileIndex } })
        })

    } catch (error) {
        console.error(error)
        res.status(500).send('Error streaming file')

    }
})


app.get('/download-all/:jobId', async (req, res) => {
    try {

        const { jobId } = req.params

        const job = await Job.findById(jobId)


        if (!job || job.status !== 'COMPLETED') return res.status(404).json({ success: false, message: 'Not ready for download or does not exist!' })

        res.attachment(`results-${jobId}.zip`)

        const archive = archiver('zip', { zlib: { level: 9 } })

        archive.pipe(res)

        for (const obj of job.outputUrls) {
            const stream = await minioClient.getObject('multimedia', obj)
            archive.append(stream, { name: path.basename(obj) })
        }


        archive.finalize()


        res.on('finish', async () => {
            const allIndices = job.outputUrls.map((_, i) => i)
            await Job.findByIdAndUpdate(jobId, { $addToSet: { downloadedIndices: allIndices } })
        })



    } catch (error) {
        console.log(error)
        res.status(500).send('Error downloading files!')
    }
})



app.get('/api/jobs/history', async (req, res) => {
    try {
        const userId = req.user._id;

        // 1. Get page and limit from query, with defaults
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        // 2. Fetch the jobs for the current page and the total count in parallel
        const [jobs, totalCount] = await Promise.all([
            Job.find({ userId })
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit),
            Job.countDocuments({ userId })
        ]);

        // 3. Return the structured response the frontend expects
        res.json({
            jobs,
            totalCount,
            totalPages: Math.ceil(totalCount / limit),
            currentPage: page
        });
    } catch (error) {
        console.error("History Error:", error);
        res.status(500).json({ message: "Greška pri čitanju istorije" });
    }
});


app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }))



app.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: '/login' }), (req, res) => {
    res.redirect(process.env.FRONTEND_URL)
})


app.post('/auth/register', async (req, res) => {
    try {
        const { email, password, displayName } = req.body

        if (!email || !password || !displayName) {
            return res.status(400).json({ success: false, message: 'Email,password and name are required' })
        }

        const existingUser = await User.findOne({ email })
        if ((existingUser)) {
            return res.status(400).json({ success: false, message: 'Email is already in use!' })
        }


        const newUser = new User({
            email,
            password,
            displayName,
            authMethod: 'local'
        })


        await newUser.save()
        return res.status(201).json({ success: true, message: "User created successfully!" })

    } catch (error) {
        console.eror('Registration error :', error)
        res.status(500).json({ success: false, message: 'Internal server error!' })

    }
})


app.post('/auth/login', (req, res, next) => {
    passport.authenticate('local', (err, user, info) => {
        if (err) return next(err)
        if (!user) return res.status(401).json({ success: false, message: info.message })

        req.logIn(user, (err) => {
            if (err) return next(err)
            return res.json({ success: true, message: 'Logged in!' })
        })
    })(req, res, next)
})

app.get('/auth/status', (req, res) => {
    if (req.isAuthenticated()) {
        res.json({ loggedIn: true, user: req.user });
    } else {
        res.json({ loggedIn: false });
    }
});


app.post('/auth/logout', (req, res, next) => {
    req.logout((err) => {
        if (err) { return next(err); }

        req.session.destroy((err) => {
            if (err) {
                return res.status(500).json({ status: false, message: "Could not log out" });
            }

            res.clearCookie('connect.sid');

            return res.json({ status: true, message: "Logged out successfully" });
        });
    });
});




const PORT = process.env.PORT || 5000

server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`)
})
