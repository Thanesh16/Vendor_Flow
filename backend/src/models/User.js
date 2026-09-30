const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserRoles = Object.freeze({
  ADMIN: 'ADMIN',
  PROCUREMENT_MANAGER: 'PROCUREMENT_MANAGER',
  EMPLOYEE: 'EMPLOYEE',
  VENDOR: 'VENDOR',
});

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'User name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'User email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
    },
    password: {
      type: String,
      required: [true, 'User password is required'],
      minlength: [6, 'Password must be at least 6 characters long'],
      select: false, // Never return password by default
    },
    role: {
      type: String,
      enum: {
        values: Object.values(UserRoles),
        message: '{VALUE} is not a valid role',
      },
      default: UserRoles.VENDOR,
      required: [true, 'User role is required'],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: function (doc, ret) {
        delete ret.password;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Hash password prior to saving
userSchema.pre('save', async function () {
  if (!this.isModified('password')) {
    return;
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Instance method to compare candidate password with stored hash
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model('User', userSchema);

module.exports = {
  User,
  UserRoles,
};
