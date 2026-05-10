const ffmpeg = require('fluent-ffmpeg')
const { spawn } = require('child_process') // Koristimo spawn za bolju kontrolu
const path = require('path')
const fs = require('fs')

const mapRange = (value, inMin, inMax, outMin, outMax) => {
    return Math.round(((value - inMin) * (outMax - outMin)) / (inMax - inMin) + outMin)
}

const RESOLUTIONS = {
    '1080p': 1080, '720p': 720, '480p': 480, '360p': 360, '144p': 144
}

module.exports = {
    VIDEO_THUMBNAILS: (input, jobId, onProgress, options) => {
        let command;
        const output = `/tmp/${jobId}_collage.jpg`
        const promise = new Promise((resolve, reject) => {
            command = ffmpeg(input)
                .videoFilters(["select='not(mod(n,300))'", "scale=320:-1", "tile=3x3"])
                .frames(1)
                .on('progress', (p) => {
                    if (p.percent && onProgress) {
                        onProgress(mapRange(Math.max(0, Math.min(100, p.percent)), 0, 100, 20, 80))
                    }
                })
                .on('end', () => resolve([output]))
                .on('error', (err) => {
                    if (err.message.includes('SIGKILL')) return reject(new Error('ABORTED'));
                    reject(err);
                })
                .save(output);
        });
        return { promise, abort: () => command.kill('SIGKILL') };
    },

    AUDIO_EXTRACT: (input, jobId, onProgress, options) => {
        let command;
        const output = `/tmp/${jobId}_audio.mp3`
        const promise = new Promise((resolve, reject) => {
            command = ffmpeg(input)
                .noVideo()
                .audioCodec('libmp3lame')
                .on('progress', (p) => {
                    if (p.percent && onProgress) {
                        onProgress(mapRange(Math.max(0, Math.min(100, p.percent)), 0, 100, 20, 80))
                    }
                })
                .on('end', () => resolve([output]))
                .on('error', (err) => {
                    if (err.message.includes('SIGKILL')) return reject(new Error('ABORTED'));
                    reject(err);
                })
                .save(output);
        });
        return { promise, abort: () => command.kill('SIGKILL') };
    },

    VIDEO_RESIZE: (input, jobId, onProgress, options) => {
        let command;
        const targetRes = options && options.resolution ? options.resolution : '480p'
        const height = RESOLUTIONS[targetRes] || 480
        const output = `/tmp/${jobId}_${height}.mp4`
        const promise = new Promise((resolve, reject) => {
            command = ffmpeg(input)
                .videoFilters([`scale=-2:${height}`, 'pad=ceil(iw/2)*2:ceil(ih/2)*2'])
                .videoCodec('libx264')
                .on('progress', (p) => {
                    if (p.percent && onProgress) {
                        onProgress(mapRange(Math.max(0, Math.min(100, p.percent)), 0, 100, 20, 80))
                    }
                })
                .on('end', () => resolve([output]))
                .on('error', (err) => {
                    if (err.message.includes('SIGKILL')) return reject(new Error('ABORTED'));
                    reject(err);
                })
                .save(output);
        });
        return { promise, abort: () => command.kill('SIGKILL') };
    },

    OCR_DOCUMENT: (input, jobId, onProgress, options) => {
        let currentProcess = null;
        const outputBase = `/tmp/${jobId}_ocr`;
        const outputPdf = `${outputBase}.pdf`;
        const outputGif = `/tmp/${jobId}_thumb.gif`;
        const listFile = `/tmp/${jobId}_list.txt`;

        const promise = new Promise((resolve, reject) => {
            const inputFiles = Array.isArray(input) ? input : [input];
            if (onProgress) onProgress(25);
            fs.writeFileSync(listFile, inputFiles.join('\n'));

            currentProcess = spawn('tesseract', [listFile, outputBase, 'pdf']);

            currentProcess.on('close', (code) => {
                if (code === 0) {
                    if (onProgress) onProgress(60);

                    console.log(`[Job ${jobId}] PDF created. Converting to GIF...`);
                    currentProcess = spawn('convert', [
                        '-delay', '100', '-loop', '0', '-density', '150', outputPdf,
                        '-background', 'white', '-alpha', 'remove', '-dispose', 'Background',
                        '-resize', '300x', outputGif
                    ]);

                    currentProcess.on('close', (magikCode) => {
                        if (fs.existsSync(listFile)) fs.unlinkSync(listFile);
                        if (magikCode === 0) {
                            if (onProgress) onProgress(80);
                            resolve([outputPdf, outputGif]);
                        } else {
                            // Ako ImageMagick pukne, bar imamo PDF
                            resolve([outputPdf]);
                        }
                    });
                } else {
                    if (fs.existsSync(listFile)) fs.unlinkSync(listFile);
                    if (currentProcess.killed) reject(new Error('ABORTED'));
                    else reject(new Error(`Tesseract failed with code ${code}`));
                }
            });
        });

        return {
            promise,
            abort: () => { if (currentProcess) currentProcess.kill('SIGKILL'); }
        };
    }
}
