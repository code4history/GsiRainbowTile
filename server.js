const express = require("express");
const app = express();

app.set("port", process.env.PORT || 3000);

app.use(express.static("build"));

app.listen(app.get("port"), () => {
  console.log(`http://localhost:${app.get("port")}`);
});

app.use('/tile', function (req, res, next) {
  console.log('Request Type:', req.method)
  next()
})

app.use(express.static("public"));

