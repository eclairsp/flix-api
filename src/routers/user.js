const express = require("express");
const multer = require("multer");
const validator = require("validator");
const sharp = require("sharp");

const auth = require("../middleware/auth");

const router = new express.Router();

const User = require("./../models/user");

const upload = multer({
    limits: {
        fileSize: 2000000
    },
    fileFilter(req, file, cb) {
        if (!file.originalname.match(/\.(png|jpg|jpeg)$/)) {
            return cb(new Error("Not a suppported file!"));
        }

        cb(undefined, true);
    }
});

const errorMessageWrongId = {
    code: 400,
    message: "Invalid user ID"
};

const errorMessageUser = {
    code: 404,
    message: "User not found"
};

const errorMessageServer = {
    code: 500,
    message: "Server Error"
};

const errorMessageData = {
    code: 400,
    message: "Check your data"
};

const errorMessageField = {
    code: 400,
    message: "Field not updatable or doesn't exist"
};

const errorMessageLogin = {
    code: 400,
    message: "Login failed!"
};

const successMessageAvatar = {
    code: 200,
    message: "Avatar saved"
};

const errorMessageAvatar = {
    code: 404,
    message: "Image not fond!"
};

router.post("/user", async (req, res) => {
    const user = new User(req.body);

    const findUser = await User.findOne({
        username: user.username
    });
    if (findUser) {
        return res.status(400).send({
            code: 1001,
            message: "User already exists!"
        });
    }

    try {
        const token = await user.generateAuthToken();
        res.status(201).send({user: await user.getPublicProfile(), token});
    } catch (error) {
        res.status(400).send(errorMessageData);
    }
});

router.post("/user/login", async (req, res) => {
    try {
        const user = await User.findByCredentials(
            req.body.username,
            req.body.password
        );
        console.log(user);
        const token = await user.generateAuthToken();

        res.status(200).send({user: await user.getPublicProfile(), token});
    } catch (error) {
        res.status(400).send(errorMessageLogin);
    }
});

router.post("/user/logout", auth, async (req, res) => {
    try {
        req.user.tokens = req.user.tokens.filter(token => {
            return token.token !== req.token;
        });

        await req.user.save();

        res.send();
    } catch (error) {
        res.status(500).send(error);
    }
});

router.post("/user/logoutAll", auth, async (req, res) => {
    try {
        req.user.tokens = [];

        await req.user.save();

        res.send();
    } catch (error) {
        res.status(500).send(error);
    }
});

router.get("/user/me", auth, async (req, res) => {
    res.send({user: await req.user.getPublicProfile()});
});

router.delete("/user/delete", auth, async (req, res) => {
    const _id = req.user._id;

    try {
        await User.findByIdAndRemove(_id);
        res.status(200).send({
            code: 101,
            message: "Deleted!"
        });
    } catch (error) {
        res.status(400).send({
            code: 99,
            message: "Cannot deleted!"
        });
    }
});

router.post("/user/fav", auth, async (req, res) => {
    const _id = req.user._id.toString();

    if (!validator.isMongoId(_id)) {
        return res.status(400).send(errorMessageWrongId);
    }

    if (!(req.body.type === "movie" || req.body.type === "tv")) {
        return res.status(400).send({
            code: 400,
            message: "Type can be 'movie' or 'tv' only"
        });
    }

    const updates = Object.keys(req.body);
    const allowedUpdates = ["tmdbID", "type"];

    const isValidField = updates.every(update =>
        allowedUpdates.includes(update)
    );

    if (!isValidField) {
        return res.status(400).send(errorMessageField);
    }

    try {
        const user = await User.findById(_id);
        if (!user) {
            return res.status(404).send(errorMessageUser);
        }

        let isNotUnique;

        user.favs.forEach(val => {
            if (val.tmdbID === req.body.tmdbID) {
                isNotUnique = val.type === req.body.type ? true : false;
            }
        });

        console.log(isNotUnique);

        if (isNotUnique) {
            return res.status(400).send({
                code: 400,
                message: "Already added"
            });
        }

        const tmdbID = req.body.tmdbID;
        const type = req.body.type;
        const isSpaces = /\s/.test(tmdbID);

        if (isSpaces) {
            return res.status(400).send({
                code: 603,
                message: "Spaces not allowed"
            });
        }

        user.favs = user.favs.concat({tmdbID, type});

        await user.save();

        res.send({
            code: 200,
            message: "Added"
        });
    } catch (error) {
        res.status(400).send(errorMessageData);
    }
});

router.post("/user/get/fav", auth, async (req, res) => {
    const _id = req.user._id.toString();

    if (!validator.isMongoId(_id)) {
        return res.status(400).send(errorMessageWrongId);
    }

    try {
        const user = await User.findOne({_id});
        if (!user) {
            return res.status(404).send(errorMessageUser);
        }

        let favs;

        if (
            req.query.type &&
            (req.query.type === "movie" || req.query.type === "tv")
        ) {
            favs = user.favs.filter(fav => {
                return fav.type === req.query.type;
            });
            res.send({favourites: favs});
        } else if (
            req.query.type &&
            !(req.query.type === "movie" || req.query.type === "tv")
        ) {
            return res.status(400).send({
                code: 400,
                message: "Type can be 'movie' or 'tv' only"
            });
        } else {
            res.send({favourites: user.favs});
        }
    } catch (error) {
        res.status(500).send(errorMessageServer);
    }
});

router.delete("/user/remove/fav", auth, async (req, res) => {
    console.log("hi", req.body.tmdbID);
    const _id = req.user._id.toString();

    if (!validator.isMongoId(_id)) {
        return res.status(400).send(errorMessageWrongId);
    }

    try {
        req.user.favs = req.user.favs.filter(val => {
            return val.tmdbID !== req.body.tmdbID || val.type !== req.body.type;
        });

        console.log(req.user.favs);

        await req.user.save();

        res.send({
            code: 200,
            message: "Removed"
        });
    } catch (error) {
        res.status(500).send(error);
    }
});

router.post(
    "/user/me/avatar",
    auth,
    upload.single("avatar"),
    async (req, res) => {
        const buffer = await sharp(req.file.buffer)
            .resize({width: 250, height: 250})
            .png()
            .toBuffer();
        req.user.avatar = buffer;
        await req.user.save();
        res.send(successMessageAvatar);
    },
    (error, req, res, next) => {
        res.status(400).send({
            code: 400,
            message: error.message
        });
    }
);

router.get(
    "/user/:id/avatar",
    async (req, res) => {
        const username = req.params.id;
        console.log(username);

        try {
            const user = await User.find({username: username});

            console.log(!user, user[0].avatar);

            if (!user || !user[0].avatar) {
                throw new Error("No user found");
            }

            res.set("Content-Type", "image/png");
            res.send(user[0].avatar);
        } catch (error) {
            console.log(error);
            res.status(404).send(errorMessageAvatar);
        }
    },
    (error, req, res, next) => {
        res.status(400).send();
    }
);

router.delete(
    "/user/me/avatar",
    auth,
    async (req, res) => {
        req.user.avatar = undefined;
        await req.user.save();
        res.send({
            message: "Succesful"
        });
    },
    (error, req, res, next) => {
        res.status(400).send({
            code: 400,
            message: "Avatar not removed"
        });
    }
);

router.patch("/user/:id", auth, async (req, res) => {
    const _id = req.users._id;
    if (!validator.isMongoId(_id)) {
        return res.status(400).send(errorMessageWrongId);
    }

    const updates = Object.keys(req.body);
    const allowedUpdates = ["name", "username", "password"];

    const isValidField = updates.every(update =>
        allowedUpdates.includes(update)
    );

    if (!isValidField) {
        res.status(400).send(errorMessageField);
    }

    const validUsername = await User.findOne({username: req.body.username});

    if (validUsername) {
        return res.status(400).send({
            code: 1001,
            message: "Username taken"
        });
    }

    try {
        const user = await User.findById(_id);

        updates.forEach(field => (user[field] = req.body[field]));

        await user.save();

        // const user = await User.findByIdAndUpdate(_id, req.body, {
        //     new: true,
        //     runValidators: true
        // });

        if (!user) {
            return res.status(404).send(errorMessageUser);
        }

        res.send({user: await user.getPublicProfile()});
    } catch (error) {
        res.status(400).send(errorMessageData);
    }
});

module.exports = router;
