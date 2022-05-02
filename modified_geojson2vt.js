// Base: https://github.com/hotosm/geojson2vt
// Modified from 0.1.3(#1123a59) at May 2 2022

const vtpbf = require('vt-pbf');
const geojsonvt =  require('geojson-vt');
const zlib  = require('zlib');

const modified_geojson2vt = function(geojson, target_zoom, target_x, target_y) {
  const tileIndex = geojsonvt(geojson, {
    minZoom: target_zoom,
    maxZoom: target_zoom,
    indexMaxZoom: target_zoom,
    indexMaxPoints: 0
  });

  const pbfOptions = {};
  const tile = tileIndex.getTile(target_zoom, target_x, target_y);
  if (tile != null) {
    pbfOptions["contour"] = tile;
    return zlib.gzipSync(vtpbf.fromGeojsonVt(pbfOptions));
  } else {
    return null;
  }
};

module.exports = modified_geojson2vt;
