# @fand/gifuct-js

A Simple to use javascript .GIF decoder.

This is a fork of [matt-way/gifuct-js](https://github.com/matt-way/gifuct-js), refactored in CommonJS style.


## Install

```
npm i @fand/gifuct-js
```

## Usage

The decoder uses **[js-binary-schema-parser][5]** to parse the gif files (you can examine the schema in the source).
This means the gif file must firstly be converted into a `Uint8Array` buffer in order to decode it. Some examples:


```typescript
import GIF from '@fand/gifuct-js';

const gif = await fetch(gifURL)
    .then(resp => resp.arrayBuffer())
    .then(buff => new GIF(buff));

const frames = await gif.decompressFrames(true);
```

### Frames

The result of the `decompressFrames(buildPatch)` function returns an array of all the GIF image frames, and their meta data. Here is a an example frame:

```js
{
    // The color table lookup index for each pixel
    pixels: [...],

    // the dimensions of the gif frame (see disposal method)
    dims: {
        top: 0,
        left: 10,
        width: 100,
        height: 50
    },

    // the time in milliseconds that this frame should be shown
    delay: 50,

    // the disposal method (see below)
    disposalType: 1,

    // an array of colors that the pixel data points to
    colorTable: [...],

    // An optional color index that represents transparency (see below)
    transparentIndex: 33,

    // Uint8ClampedArray color converted patch information for drawing
    patch: [...],
}
```

#### Automatic Patch Generation

If the `buildPatch` param of the `dcompressFrames()` function is `true`, the parser will not only return the parsed and decompressed gif frames, but will also create canvas ready `Uint8ClampedArray` arrays of each gif frame image, so that they can easily be drawn using `ctx.putImageData()` for example. This requirement is common, however it was made optional because it makes assumptions about transparency. The [demo][4] makes use of this option.

#### Disposal Method

The `pixel` data is stored as a list of indexes for each pixel. These each point to a value in the `colorTable` array, which contain the color that each pixel should be drawn. Each frame of the gif may not be the full size, but instead a patch that needs to be drawn over a particular location. The `disposalType` defines how that patch should be drawn over the gif canvas. In most cases, that value will be `1`, indicating that the gif frame should be simply drawn over the existing gif canvas without altering any pixels outside the frames patch dimensions. More can be read about this [here][6].

#### Transparency

If a `transparentIndex` is defined for a frame, it means that any pixel within the pixel data that matches this index should not be drawn. When drawing the patch using canvas, this means setting the alpha value for this pixel to `0`.

## LICENSE

MIT
