const express = require("express");
const cors = require("cors");

require("./db/mongoose");

const userRouter = require("./routers/user");

const app = express();
const port = process.env.PORT;

app.use(cors());
app.use(express.json());

app.use(userRouter);

app.listen(port, () => {
    console.log("server is up at: ", port);
});
