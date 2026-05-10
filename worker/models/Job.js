const mongoose = require('mongoose')



const JobSchema = new mongoose.Schema({
    originalName: { type: String, required: true },
    s3Key: { type: String, required: true },
    status: { type: String, enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'ABORTED'], default: 'PENDING' },
    progress: { type: Number, default: 0 },
    type: { type: String, enum: ['VIDEO_THUMBNAILS', 'VIDEO_RESIZE', 'AUDIO_EXTRACT', "OCR_DOCUMENT"] },
    outputUrls: [{ type: String }],
    error: { type: String },
    createdAt: { type: Date, default: Date.now },
    workerPid: { type: Number }

})


module.exports = mongoose.model('Job', JobSchema)
