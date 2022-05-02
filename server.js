const express = require("express")
const app = express()
const {loadImage, createCanvas} = require("canvas")
const {featureCollection, lineString, multiLineString} = require("@turf/helpers")
const proj4 = require("proj4")
const modified_geojson2mvt = require("./modified_geojson2vt")

app.set("port", process.env.PORT || 3000);

app.use(express.static('public'));

// 微小地形段彩図

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
          if ( datum[ base + 3 ] === 0 )  {
            if (index === data.length - 1) {
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

    res.type("image/png")
    res.send(png_out)
  } catch(e) {
    res.status(404)
    res.send("Not found")
  }
}

app.get('/tile/:ch/:z/:x/:y', async (req, res) => {
  tileResponcer(req, res, ["dem"], RainbowColor)
})

app.get('/dem5/:ch/:z/:x/:y', async (req, res) => {
  tileResponcer(req, res, ["dem5a","dem5b","dem"], RainbowColor)
})

app.get('/cont7/:smallheight/:interval/:z/:x/:y', async (req, res) => {
  tileResponcer(req, res, ["dem5a"], Contour7Colors)
})

app.get('/cont7r/:smallheight/:interval/:z/:x/:y', async (req, res) => {
  tileResponcer(req, res, ["dem"], Contour7Colors)
})

app.get('/contg/:smallheight/:interval/:z/:x/:y', async (req, res) => {
  tileResponcer(req, res, ["dem5a"], ContourGrayScale)
})

app.get('/contgr/:smallheight/:interval/:z/:x/:y', async (req, res) => {
  tileResponcer(req, res, ["dem"], ContourGrayScale)
})

app.listen(app.get("port"), () => {
  console.log(`http://localhost:${app.get("port")}`)
})

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
      if (index === this.colors.length - 1) return color
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

class ContourGrayScale extends Contour7Colors {
  constructor(req) {
    super(req)
    this.colors = [
      [71,  71,  71],  // 83
      [116, 116, 116], //126
      [149, 149, 149], //157
      [170, 170, 170], //176
      [192, 192, 192], //196
      [210, 210, 210], //212
      [231, 231, 231]  //231
    ]
  }
}

// 等高線タイル

const recursiveProjection = (array, zoom, x, y) => {
  const proj_key = `PROJKEY:${zoom}`
  if (!proj4.defs(proj_key)) {
    proj4.defs(proj_key, `+proj=merc +a=${Math.pow(2, zoom + 7) / Math.PI} +b=${Math.pow(2, zoom + 7) / Math.PI} +lat_ts=0.0 +lon_0=0.0 +x_0=${Math.pow(2, zoom + 7)} +y_0=${Math.pow(2, zoom + 7)} +k=1.0 +units=m +nadgrids=@null +no_defs`)
  }

  return array[0] instanceof Array ?
    array.map((item) => recursiveProjection(item, zoom, x, y)) :
    proj4(proj_key, "EPSG:4326", [(array[0] + 0.5) + (x - 1) * 256, Math.pow(2, zoom + 7) * 2 - (array[1] + 0.5) -  (y - 1) * 256])
}

const recursiveKillNull = (array) => {
  return array.reduce((prev, item) => {
    item = item instanceof Array ? recursiveKillNull(item) : item
    if (item != null) {
      if (prev == null) prev = []
      prev.push(item)
    }
    return prev
  }, undefined)
}

/*app.get('/contour/tilejson/:interval/:bold', async (req, res) => {
  try {
    const interval = req.params.interval != null ? req.params.interval : 0.5
    const bold = req.params.bold != null ? req.params.bold : 2.5

    const json = {
      tilejson: "3.0.0",
      tiles: [ `` ]
    }

    res.type("application/json")
    res.send(JSON.stringify(json))
  } catch(e) {
    res.status(404)
    res.send("Not found")
  }
})*/

app.get('/contline/:interval/:bold/:z/:x/:y', async (req, res) => {
  try {
    const d3 = await import("d3")
    const dems = ["dem5a"]

    const zoom = req.params.z != null ? req.params.z : 15
    const x = req.params.x != null ? req.params.x : 29084
    const y = req.params.y != null ? req.params.y : 12841

    const interval = req.params.interval != null ? req.params.interval : 0.5
    const bold = req.params.bold != null ? req.params.bold : 2.5
    const wh = 256 * 3
    const relative_coords = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 0], [0, 1], [1, -1], [1, 0], [1, 1]]
    const canvas = createCanvas(wh, wh)
    const context = canvas.getContext('2d');
    const coord_images = await Promise.all(relative_coords.map(async (coords) => {
      const lx = x + coords[0]
      const ly = y + coords[1]

      return Promise.all(dems.map(async (dem) => {
        const tile_url = `https://cyberjapandata.gsi.go.jp/xyz/${dem}_png/${zoom}/${lx}/${ly}.png`
        return loadImage(tile_url)
      }))
    }))

    relative_coords.map((coords, index) => {
      const lx = coords[0]
      const ly = coords[1]
      const image = coord_images[index][0]
      context.drawImage(image, (lx + 1) * 256, (ly + 1) * 256, 256, 256)
    })

    let r, g, b, xx, min = null, max = null
    const u = 0.01 // 標高分解能0.01m
    const data = context.getImageData(0, 0, wh, wh).data
    const values = new Array(wh * wh)

    for (let ly = 0; ly < wh; ly++) {
      for (let lx = 0; lx < wh; lx++) {
        const k = ly * wh + lx
        const base = k * 4

        if ( data[ base + 3 ] === 0 )  {
          values[k] = 0
        } else {
          r = data[ base ]
          g = data[ base + 1 ]
          b = data[ base + 2 ]
          xx = 2**16 * r + 2**8 * g + b
          values[k] = ( xx <  2**23 ) ? xx * u: ( x - 2 ** 24 ) * u
          if (min == null) {
            min = max = values[k]
          } else if (values[k] < min && values[k] > -100) {
            min = values[k]
          } else if (values[k] > max) {
            max = values[k]
          }
        }
      }
    }

    const intmin = Math.ceil(min / interval)
    const intmax = Math.floor(max / interval)
    const thresholds = []
    for (let i = intmin; i <= intmax; i++) {
      thresholds.push(i * interval)
    }

    const contour_array = d3.contours()
      .size([wh, wh])
      .thresholds(thresholds)
      (values)

    const noClip = featureCollection(contour_array.reduce((prev, contour) => {
      if (contour.coordinates.length === 0) return prev
      const lineArray = []
      const coords = recursiveProjection(contour.coordinates, zoom, x, y)
      coords.forEach((coords1) => {
        const line = lineString(coords1[0], {value: contour.value})
        lineArray.push(line.geometry.coordinates)
      })
      if (lineArray.length === 0) return prev
      const props = {
        height: contour.value,
        bold: contour.value % bold === 0
      }
      prev.push(multiLineString(lineArray, props))
      return prev
    }, []))

    const pbf = modified_geojson2mvt(noClip, zoom, x, y)

    res.type("application/vnd.mapbox-vector-tile")
    res.send(pbf)
  } catch(e) {
    res.status(404)
    res.send(JSON.stringify(e))
  }
})
