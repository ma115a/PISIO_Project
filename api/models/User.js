const mongoose = require('mongoose')
const bcrypt = require('bcryptjs');




const UserSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        lowercase: true,
        trim: true
    },
    password: {
        type: String,
        select: false
    },
    googleId: {
        type: String,
        unique: true,
        sparse: true
    },
    displayName: {
        type: String
    },
    image: {
        type: String
    },
    authMethod: {
        type: String,
        enum: ['local', 'google'],
        default: 'local'
    }
}, { timestamps: true })



UserSchema.pre('save', async function () {
    if (!this.isModified('password') || !this.password) return
    const salt = await bcrypt.genSalt(10)
    this.password = await bcrypt.hash(this.password, salt)
})


UserSchema.methods.comparePassword = async function (candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password)
}



module.exports = mongoose.model('User', UserSchema)

