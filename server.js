const express = require("express");
const {loadImage, createCanvas} = require("canvas");
const app = express();

app.set("port", process.env.PORT || 3000);

app.use(express.static('public'));

app.get('/tile', (req, res) => {
  console.log('Request Type:', req.method)
  res.send(`Hoge ${loadImage} ${createCanvas}`)
});

app.listen(app.get("port"), () => {
  console.log(`http://localhost:${app.get("port")}`);
});
