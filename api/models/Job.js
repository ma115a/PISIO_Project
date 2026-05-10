const mongoose = require('mongoose')



const JobSchema = new mongoose.Schema({
    originalName: { type: String, required: true },
    s3Keys: [{ type: String }],
    status: { type: String, enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'ABORTED'], default: 'PENDING' },
    progress: { type: Number, default: 0 },
    type: { type: String, enum: ['VIDEO_THUMBNAILS', 'VIDEO_RESIZE', 'AUDIO_EXTRACT', "OCR_DOCUMENT"] },
    outputUrls: [{ type: String }],
    error: { type: String },
    workerPid: { type: Number },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true

    },
    downloadedIndices: { type: [Number], default: [] }

}, { timestamps: true })


module.exports = mongoose.model('Job', JobSchema)
