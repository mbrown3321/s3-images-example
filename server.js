const express = require("express");
const passport = require("passport");
const Strategy = require("passport-local").Strategy;
const models = require("./models");
const formidable = require("formidable");
const { v4: uuidv4 } = require("uuid");
const fs = require("fs");
const AWS = require("aws-sdk");
const S3 = new AWS.S3({
  signatureVersion: "v4",
  apiVersion: "2006-03-01",
  accessKeyId: "YOUR_ACCESS_KEY_HERE",
  secretAccessKey: "YOUR_SECRET_ACCESS_KEY_HERE",
  region: "us-east-1",
});

passport.use(
  new Strategy(async (username, password, cb) => {
    const user = await models.user.findOne({
      where: {
        email: username,
      },
    });

    if (!user) {
      return cb(null, false);
    }

    if (user.password !== password) {
      return cb(null, false);
    }

    return cb(null, user);
  })
);

passport.serializeUser((user, cb) => {
  cb(null, user.id);
});

passport.deserializeUser(async (id, cb) => {
  const user = await models.user.findByPk(id);
  if (!user) {
    return cb({});
  }

  cb(null, user);
});

const port = process.env.PORT || 3000;
const app = express();

app.set("views", __dirname + "/views");
app.set("view engine", "ejs");

app.use(
  require("express-session")({
    secret: "changeme",
    resave: false,
    saveUninitialized: false,
  })
);
app.use(passport.initialize());
app.use(passport.session());
app.use(express.urlencoded({ limit: "100mb" }));
app.use(require("body-parser").urlencoded({ extended: true }));

app.get("/health", (req, res) => {
  res.sendStatus(200);
});

app.get("/", (req, res) => {
  res.render("home", { user: req.user });
});

app.get("/login", (req, res) => {
  res.render("login");
});

app.post(
  "/login",
  passport.authenticate("local", { failureRedirect: "/login" }),
  (req, res) => {
    res.redirect("/");
  }
);

app.get("/register", (req, res) => {
  res.render("register");
});

app.post(
  "/register",
  async (req, res, next) => {
    await models.user.create({
      email: req.body.username,
      password: req.body.password,
    });

    next();
  },
  passport.authenticate("local", { failureRedirect: "/login" }),
  (req, res) => {
    res.redirect("/");
  }
);

app.get("/upload", (req, res) => {
  res.render("upload");
});

app.post("/upload", (req, res, next) => {
  const form = formidable({ multiples: true });
  form.parse(req, async (err, fields, files) => {
    if (err) {
      next(err);
      return;
    }

    const id = uuidv4();
    S3.putObject(
      {
        Bucket: "YOUR_BUCKET_HERE",
        Key: id,
        ContentType: files.file.type,
        ContentLength: files.file.size,
        Body: fs.createReadStream(files.file.path),
      },
      async (data) => {
        await models.upload.create({
          id,
          file_name: files.file.name,
          user_id: req.user.id,
        });

        res.redirect("/");
      }
    );
  });
});

function getSignedUrl(key) {
  return new Promise((resolve, reject) => {
    S3.getSignedUrl(
      "getObject",
      {
        Bucket: "YOUR_BUCKET_HERE",
        Key: key,
      },
      function (err, url) {
        if (err) reject(err);

        resolve(url);
      }
    );
  });
}

app.get("/files", async (req, res) => {
  let uploads = await models.upload.findAll({
    where: {
      user_id: req.user.id,
    },
  });

  uploads = await Promise.all(
    uploads.map(async (upload) => {
      const url = await getSignedUrl(upload.id);

      return {
        ...upload.toJSON(),
        url,
      };
    })
  );

  res.render("files", { uploads });
});

app.get("/logout", (req, res) => {
  req.logout();
  res.redirect("/");
});

// Start the app
app.listen(port, () => console.log(`API listening on ${port}`));
