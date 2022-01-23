const express = require("express");
const {loadImage, createCanvas} = require("canvas");
const app = express();

app.set("port", process.env.PORT || 3000);

app.use(express.static('public'));

const tileResponcer = async (req, res, dems, Handler) => {
  try {
    //各入力値(文字列)を取得
    //https://cyberjapandata.gsi.go.jp/xyz/dem_png/8/227/100.png
    const zoom = req.params.z != null ? req.params.z : 8
    const x = req.params.x != null ? req.params.x : 227
    const y = req.params.y != null ? req.params.y : 100
    const cycleHeight = req.params.ch != null ? req.params.ch : 80
    const handler = new Handler(req)

    // 画像読み込み
    const images = await Promise.all(dems.map(async (dem) => {
      const tile_url = `https://cyberjapandata.gsi.go.jp/xyz/${dem}_png/${zoom}/${x}/${y}.png`
      return loadImage(tile_url)
    }))
    const canvases = images.map(image => createCanvas(image.width, image.height))
    const contexts = canvases.map((canvas, index) => {
      const context = canvas.getContext('2d')
      context.drawImage(images[index], 0, 0)
      return context
    })

    //干渉色のcanvasの準備
    const canvas2 = createCanvas(images[0].width, images[0].height)
    const context2 = canvas2.getContext('2d')

    // キャンバス全体のピクセル情報を取得
    const imageData_iceMap = context2.getImageData(0, 0, canvas2.width, canvas2.height);
    const width_iceMap = imageData_iceMap.width, height_iceMap = imageData_iceMap.height;
    const pixels_iceMap = imageData_iceMap.data;  // ピクセル配列：RGBA4要素で1ピクセル

    let r, g, b, xx, h
    const u = 0.01 // 標高分解能0.01m
    const data = contexts.map((context, index) => {
      return context.getImageData(0, 0, images[index].width, images[index].height).data;
    })

    /////////干渉色標高図の描画///
    // ピクセル単位操作
    for (let y = 0; y < height_iceMap; ++y) {
      for (let x = 0; x < width_iceMap; x = x + handler.dots ) {
        const base = (y * width_iceMap + x) * 4

        //地理院DEMタイルから標高値の読み出し
        data.reduce((prev, datum, index) => {
          if (prev) return prev
          if ( datum[ base + 3 ] == 0 )  {
            if (index == data.length - 1) {
              r = 0
              g = 0
              b = 0
              console.log( '無効値' )
              h = 0 //とりあえず無効値の場合は標高0mとした。後日必要に応じ別の値に。。
            } else {
              console.log("Bad data")
              return false
            }
          } else {
            r = datum[ base ]
            g = datum[ base + 1 ]
            b = datum[ base + 2 ]
            xx = 2**16 * r + 2**8 * g + b
            h = ( xx <  2**23 ) ? xx * u: ( x - 2 ** 24 ) * u
            return true
          }
        }, false)

        handler.paintContext(h, base, pixels_iceMap)
      }
    }

    // 変更した内容をキャンバスに書き戻す
    context2.putImageData(imageData_iceMap, 0, 0)
    const png_out = canvas2.toBuffer('image/png', {})

    res.type("png")
    res.send(png_out)
  } catch(e) {
    res.status(404)
    res.send("Not found")
  }
};

app.get('/tile/:ch/:z/:x/:y', async (req, res) => {
  tileResponcer(req, res, ["dem"], RainbowColor)
});

app.get('/dem5/:ch/:z/:x/:y', async (req, res) => {
  tileResponcer(req, res, ["dem5a","dem5b","dem"], RainbowColor)
});

app.get('/cont7/:smallheight/:interval/:z/:x/:y', async (req, res) => {
  tileResponcer(req, res, ["dem5a"], Contour7Colors)
});

app.listen(app.get("port"), () => {
  console.log(`http://localhost:${app.get("port")}`);
});

class RainbowColor {
  constructor(req) {
    this.cycleHeight = req.params.ch != null ? req.params.ch : 80
    this.n_iC = 0 //色一周期の何番目か

    //フィッテイングパラメータ (R,G,Bそれぞれの値)
    this.rgb_iC  = [ 0.0 , 0.0 , 0.0 ] //色の値
    //干渉色
    this.t_iC = [ 0.64 , 0.35 , 0.355] //振幅 amplitude
    this.c_iC = [ 0.5 , 0.5 , 0.5] //中心値
    this.u_iC = [ 0.5 , 0.52 , 0.5] //位相率
    this.k_iC = [ 2.98 , 3.71 , 4.35] //波数
    this.s_iC = [ 0.105 , 0 , 0] //波長増加率
    this.alpha_iC = [ 0.2 , 0.53 , 0.5] //包絡振幅
    this.delta_iC = [ 0.5 , 0.1 , 0.042] //包絡位相率
    this.beta_iC  = [ 0.7 , 0.45 , 0.35] //包絡波数
    this.Num_iC = this.cycleHeight //色１周期で何メートルか
    this.r_iC = 0.15 //不使用階調率
    this.dots = 1 //干渉色の描画時のドット数
  }

  paintContext(h, base, pixels_iceMap) {
    for (let i = 0; i < 3; i++ ) {
      this.n_iC = h  % this.Num_iC

      //干渉色計算（cos近似式)
      this.rgb_iC[i] = this.c_iC[i] + this.t_iC[i] * ( 1 + this.alpha_iC[i] * Math.cos ( 2 * Math.PI * this.beta_iC[i] * ( this.n_iC/this.Num_iC + this.r_iC ) / ( 1 + this.r_iC ) - 2 * Math.PI * this.delta_iC[i] ) )
          * Math.cos ( 2 * Math.PI * ( 1 + this.s_iC[i] * ( this.n_iC/this.Num_iC + this.r_iC ) / ( 1 + this.r_iC ) ) * this.k_iC[i] * ( this.n_iC/this.Num_iC + this.r_iC ) / ( 1 + this.r_iC ) - 2 * Math.PI * this.u_iC[i] )

      if ( this.rgb_iC[i] > 0.0031308 ) {
        this.rgb_iC[i] = 1.055 * ( this.rgb_iC[i] ** (1/2.4) ) - 0.055
      }
      else{
        this.rgb_iC[i] = 12.92 * this.rgb_iC[i]
      }
      this.rgb_iC[i] = Math.round(255 * Math.max( 0 , Math.min(1, this.rgb_iC[i]) ) )

      // なんかピクセルに書き込む
      for ( let j = 0 ; j < this.dots + 1 ; j++){
        pixels_iceMap[base + 0 + j*4 ] = this.rgb_iC[0] // Red
        pixels_iceMap[base + 1 + j*4 ] = this.rgb_iC[1] // Green
        pixels_iceMap[base + 2 + j*4 ] = this.rgb_iC[2] // Blue
        pixels_iceMap[base + 3 + j*4 ] = 255 // Alpha
      }
    }
  }
}

class Contour7Colors {
  constructor(req) {
    this.smallHeight = req.params.smallheight != null ? parseFloat(req.params.smallheight) : 18
    this.interval = req.params.interval != null ? parseFloat(req.params.interval) : 1
    this.colors = [
      [0, 0, 255],
      [0, 149, 255],
      [0, 238, 255],
      [145, 255, 0],
      [255, 255, 0],
      [255, 140, 0],
      [255, 68, 0]
    ]

    this.dots = 1
  }

  paintContext(h, base, pixels_iceMap) {
    const color = this.colors.reduce((prev, color, index) => {
      if (prev) return prev
      if (index == this.colors.length - 1) return color
      const ceil = this.smallHeight + this.interval * index
      if (h < ceil) return color
      return null
    }, null)
    pixels_iceMap[base] = color[0] // Red
    pixels_iceMap[base + 1] = color[1] // Green
    pixels_iceMap[base + 2] = color[2] // Blue
    pixels_iceMap[base + 3] = 255 // Alpha
  }
}