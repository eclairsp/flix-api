const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const userSchema = new mongoose.Schema(
    {
        avatar: {
            type: Buffer
        },
        name: {
            type: String,
            trim: true,
            required: true
        },
        username: {
            type: String,
            required: true,
            trim: true,
            index: true,
            unique: true,
            validate(value) {
                let regex = new RegExp("^([-a-zA-Z0-9_._])+$");
                if (!regex.test(value)) {
                    throw new Error("Not valid!");
                }
            }
        },
        password: {
            type: String,
            required: true,
            minlength: 7,
            trim: true,
            validate(value) {
                if (value.toLowerCase().includes("password")) {
                    throw new Error("Password can't contain password");
                }
            }
        },
        favs: [
            {
                tmdbID: {
                    type: String
                },
                type: {
                    type: String
                }
            }
        ],
        tokens: [
            {
                token: {
                    type: String,
                    required: true
                }
            }
        ]
    },
    {
        timestamps: true
    }
);

userSchema.methods.generateAuthToken = async function() {
    const user = this;
    const token = jwt.sign({_id: user._id.toString()}, process.env.JWT_SECRET);

    user.tokens = user.tokens.concat({token});
    try {
        await user.save();
    } catch (error) {
        return error;
    }
    return token;
};

userSchema.methods.getPublicProfile = async function() {
    const user = this;

    const userObject = user.toObject();

    delete userObject.password;
    delete userObject.tokens;
    delete userObject.__v;
    delete userObject.avatar;

    userObject["code"] = "200";

    return userObject;
};

userSchema.statics.findByCredentials = async (username, password) => {
    const user = await User.findOne({username});

    if (!user) {
        throw new Error("Unable to login user");
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
        throw new Error("Unable to login password");
    }
    return user;
};

// Hashes the password
userSchema.pre("save", async function(next) {
    const user = this;

    if (user.isModified("password")) {
        const pw = await bcrypt.hash(user.password, 8);
        user.password = pw;
    }

    next();
});

const User = mongoose.model("User", userSchema);

module.exports = User;
