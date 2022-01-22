const express = require("express");
const {loadImage, createCanvas} = require("canvas");
const app = express();

app.set("port", process.env.PORT || 3000);

app.use(express.static('public'));

app.get('/tile', async (req, res) => {
  //各入力値(文字列)を取得
  //https://cyberjapandata.gsi.go.jp/xyz/dem_png/8/227/100.png
  /*const zoom = 8
  const x = 227
  const y = 100
  const cycleHeight = 80

  // 画像読み込み
  const tile_url = `https://cyberjapandata.gsi.go.jp/xyz/dem_png/${zoom}/${x}/${y}.png`
  const image = await loadImage(tile_url)
  const canvas1 = createCanvas(image.width, image.height)
  const context1 = canvas1.getContext('2d')
  context1.drawImage(image)

  //干渉色のcanvasの準備
  const canvas2 = createCanvas(image.width, image.height)
  const context2 = canvas2.getContext('2d')

  // キャンバス全体のピクセル情報を取得
  const imageData_iceMap = context2.getImageData(0, 0, canvas2.width, canvas2.height);
  const width_iceMap = imageData_iceMap.width, height_iceMap = imageData_iceMap.height;
  const pixels_iceMap = imageData_iceMap.data;  // ピクセル配列：RGBA4要素で1ピクセル

  //フィッテイングパラメータ (R,G,Bそれぞれの値)
  const rgb_iC  = [ 0.0 , 0.0 , 0.0 ] //色の値
  //干渉色
  const t_iC = [ 0.64 , 0.35 , 0.355] //振幅 amplitude
  const c_iC = [ 0.5 , 0.5 , 0.5] //中心値
  const u_iC = [ 0.5 , 0.52 , 0.5] //位相率
  const k_iC = [ 2.98 , 3.71 , 4.35] //波数
  const s_iC = [ 0.105 , 0 , 0] //波長増加率
  const alpha_iC = [ 0.2 , 0.53 , 0.5] //包絡振幅
  const delta_iC = [ 0.5 , 0.1 , 0.042] //包絡位相率
  const beta_iC  = [ 0.7 , 0.45 , 0.35] //包絡波数
  let n_iC = 0 //色一周期の何番目か
  const Num_iC = cycleHeight //色１周期で何メートルか
  const r_iC = 0.15 //不使用階調率
  const dots = 1 //干渉色の描画時のドット数

  let r, g, b, xx, h
  const u = 0.01 // 標高分解能0.01m
  const data = context1.getImageData(0, 0, image.width, image.height).data;

  /////////干渉色標高図の描画///
  // ピクセル単位操作
  for (let y = 0; y < height_iceMap; ++y) {
    for (let x = 0; x < width_iceMap; x = x + dots ) {
      const base = (y * width_iceMap + x) * 4
      for (let i = 0; i < 3; i++ ) {

        //地理院DEMタイルから標高値の読み出し
        if ( data[ base + 3 ] == 0 )  {
          r = 0
          g = 0
          b = 0
          console.log( '無効値' )
          h = 0 //とりあえず無効値の場合は標高0mとした。後日必要に応じ別の値に。。

        } else {
          r = data[ base ]
          g = data[ base + 1 ]
          b = data[ base + 2 ]
          xx = 2**16 * r + 2**8 * g + b
          h = ( xx <  2**23 ) ? xx * u: ( x - 2 ** 24 ) * u
        }

        n_iC = h  % Num_iC

        //干渉色計算（cos近似式)
        rgb_iC[i] = c_iC[i] + t_iC[i] * ( 1 + alpha_iC[i] * Math.cos ( 2 * Math.PI * beta_iC[i] * ( n_iC/Num_iC + r_iC ) / ( 1 + r_iC ) - 2 * Math.PI * delta_iC[i] ) )
            * Math.cos ( 2 * Math.PI * ( 1 + s_iC[i] * ( n_iC/Num_iC + r_iC ) / ( 1 + r_iC ) ) * k_iC[i] * ( n_iC/Num_iC + r_iC ) / ( 1 + r_iC ) - 2 * Math.PI * u_iC[i] )

        if ( rgb_iC[i] > 0.0031308 ) {
          rgb_iC[i] = 1.055 * ( rgb_iC[i] ** (1/2.4) ) - 0.055
        }
        else{
          rgb_iC[i] = 12.92 * rgb_iC[i]
        }
        rgb_iC[i] = Math.round(255 * Math.max( 0 , Math.min(1, rgb_iC[i]) ) )

        // なんかピクセルに書き込む
        for ( let j = 0 ; j < dots + 1 ; j++){
          pixels_iceMap[base + 0 + j*4 ] = rgb_iC[0] // Red
          pixels_iceMap[base + 1 + j*4 ] = rgb_iC[1] // Green
          pixels_iceMap[base + 2 + j*4 ] = rgb_iC[2] // Blue
          pixels_iceMap[base + 3 + j*4 ] = 255 // Alpha
        }
      }
    }
  }

  // 変更した内容をキャンバスに書き戻す
  context2.putImageData(imageData_iceMap, 0, 0)
  const png_out = canvas2.toBuffer('image/png', {})

  return new Response(png_out, {
    "status" : 200 ,
    "headers": new Headers([
      ['Content-Type', 'image/png']
    ])
  })*/


  console.log('Request Type:', req.method)
  res.send(`Hoge ${loadImage} ${createCanvas}`)
});

app.listen(app.get("port"), () => {
  console.log(`http://localhost:${app.get("port")}`);
});
