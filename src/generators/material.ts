import Color from "colorjs.io";
import { BASECOLOR, COLORKEYS } from "../constants";
import { materialColorSchema } from "../schemas";
import { hexToRGB } from "../converters/toRgb";
import { hexToHSL } from "../converters/toHsl";
import { RgbHslHexObject, BaseColorKey } from "../types";

type Options = {
  lockSwatch: boolean;
};

type BaseColorHexPair = {
  baseColor: BaseColorKey;
  hex: string;
};

type Scale = {
  "50": string;
  "100": string;
  "200": string;
  "300": string;
  "400": string;
  "500": string;
  "600": string;
  "700": string;
  "800": string;
  "900": string;
  A100?: string;
  A200?: string;
  A400?: string;
  A700?: string;
};

/**
 * @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
 * @
 * @  ORIGINAL ALGORITHM BUILT BY SEBASTIAN LASSE
 * @  https://codepen.io/sebilasse/pen/GQYKJd
 * @
 * @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
 */
export const hexColorReg = /^#?([A-F0-9]{6}|[A-F0-9]{3})$/i;

function specificLight(rgb: number[]) {
  const [r, g, b] = rgb;
  return 1 - (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

function colorData(hex: string, palette: any = undefined) {
  const color = new Color(!palette ? hex : palette[hex]);
  const rgb = color.srgb.map((v) => v * 255);
  const hcl = color.lch.reverse();
  const data = { rgb, hcl, sl: specificLight(rgb) };

  return data;
}

export function getSpecificLight(hex: string): number {
  const color = new Color(hex);
  const rgb = color.srgb.map((v) => v * 255);
  const [lightness] = color.lch;

  return lightness * specificLight(rgb);
}

/**
 * Acts like a sort of limiter.
 *
 * These checks overrides the base color so the usual schema for the color wouldn't apply.
 * This is due to some darker variants of colors (eg red) not looking very good.
 * Brown is for instance much "calmer" and doesn't include blue tones which red
 * otherwise does.
 *
 * This is pretty much 100% personal preference and can be tweaked quite a bit!
 */
function compressBasecolor({ baseColor, hex }: BaseColorHexPair): BaseColorKey {
  const { hcl, sl } = colorData(hex);
  const [, chroma, luminance] = hcl;

  const checkBrown = { orange: 1, deepOrange: 1, red: 1 };
  const checkBlue = {
    indigo: 1,
    blue: 1,
    lightBlue: 1,
    cyan: 1,
    blueGrey: 1,
    deepPurple: 1,
  };

  if (baseColor === "deepPurple" && chroma < 60 && luminance < 26) {
    baseColor = "blueGrey";
  }

  if (checkBrown.hasOwnProperty(baseColor) && chroma < 48) {
    baseColor = chroma < 12 ? "grey" : "brown";
  } else if (checkBlue.hasOwnProperty(baseColor) && chroma < 56 && sl > 0.32) {
    baseColor = "blueGrey";
  } else if (chroma < 16) {
    baseColor = "grey";
  }

  return baseColor;
}

/**
 * find which base color schema to use based on the provided hex
 */
function findClosestBaseColor(hex: string): BaseColorHexPair {
  const h = new Color(hex).lch[2];

  let baseColor: BaseColorKey = "grey";
  let dist = 360;

  // loop through each basecolor and set the baseColor
  Object.keys(BASECOLOR.material).forEach((baseColorName: BaseColorKey) => {
    const baseColorHex = BASECOLOR.material[baseColorName];

    // picks out the HCL values from each set material basecolor
    const hue = new Color(baseColorHex).lch[2];
    const _dist = Math.min(Math.abs(h - hue), 360 + h - hue);

    // we've found our basecolor if _dist is lower than dist
    if (_dist < dist) {
      dist = _dist;
      baseColor = baseColorName;
    }
  });

  return { baseColor, hex };
}

/**
 * Generates a scale of swatches based on the Material scheme. Always generates
 * the scale with the inputted hex at the swatch key "500".
 *
 * Uses the predefined values in `matericalColorScheme` to generate each swatch.
 */
function materialScale(hex: string, baseColor: BaseColorKey): Scale {
  /**
   *  extra notes for whoever wants to know more:
   * uses the values in src/schemas.ts to modify the hue, chroma & lightness
   * values of the inputted hex.
   *
   * ex:
   * when adding materialColorSchema.red.0 to "#f44336" it results in {h: -14,
   * c: 69, l: 95} and so on for all swatches of that base color.
   */
  const hcl = new Color(hex).lch.reverse();

  // Some colors have accent colors. some don't. We check for that here.
  const colorKeys =
    materialColorSchema[baseColor].length < COLORKEYS.length
      ? COLORKEYS.slice(0, 9)
      : COLORKEYS;

  const scale = colorKeys.reduce((acc, curr: string, idx: number) => {
    const modifiedHCL: number[] = materialColorSchema[baseColor][idx].map(
      (rangeValue, index) => hcl[index] + rangeValue
    );
    acc[curr] = new Color("lch", modifiedHCL.reverse()).hex;

    // 500 does not exist in the COLORKEYS constant so we have to fill it here
    if (curr === "400") {
      acc["500"] = hex;
    }

    return acc;
  }, {});

  return scale as Scale;
}

/**
 * returns the key, hex and LCH distance of the closest swatch to the inputted
 * hex in the inputted scale
 */
function getLchDifference(hex: string, scale: Scale) {
  const [l, c, h] = new Color(hex).lch;
  const hue = {
    dist: 360,
    key: "50",
    hex,
  };
  const chroma = {
    dist: 150,
    key: "50",
    hex,
  };
  const lightness = {
    dist: 100,
    key: "50",
    hex,
  };

  Object.entries(scale)
    .slice(0, 9)
    .forEach(([scaleKey, scaleHex]: [string, string]) => {
      const { lch } = new Color(scaleHex);
      const hueDist = Math.min(Math.abs(lch[2] - h), 360 + lch[2] - h);
      const chromaDist = Math.min(Math.abs(lch[1] - c), 150 + lch[1] - c);
      const lightnessDist = Math.min(Math.abs(lch[0] - l), 100 + lch[0] - l);

      if (hueDist < hue.dist) {
        hue.dist = hueDist;
        hue.key = scaleKey;
        hue.hex = scaleHex;
      }

      if (chromaDist < chroma.dist) {
        chroma.dist = chromaDist;
        chroma.key = scaleKey;
        chroma.hex = scaleHex;
      }

      if (lightnessDist < lightness.dist) {
        lightness.dist = lightnessDist;
        lightness.key = scaleKey;
        lightness.hex = scaleHex;
      }
    });

  return { hue, chroma, lightness };
}

/**
 * Tries to emulate the material palette generators by calculating the distances
 * between hue, chroma and lightness values of the inputted hex and each swatch
 * in all "hand-picked" scales.
 */
function generateFluidScale(hex: string) {
  const color = new Color(hex);
  const [l, c, h] = color.lch;

  let key: string;
  let hueKey: string;
  let dist = 360;
  let newBaseColor: BaseColorKey;

  // look for which hue and base color is closest to our input
  Object.entries(BASECOLOR.material).forEach(
    ([baseColorName, baseColorHex]: [any, string]) => {
      const currentScale = materialScale(baseColorHex, baseColorName);

      Object.entries(currentScale)
        .slice(0, 9)
        .forEach(([scaleKey, scaleHex]: any[]) => {
          const { lch } = new Color(scaleHex);
          const _dist = Math.min(Math.abs(lch[2] - h), 360 + lch[2] - h);

          if (_dist < dist) {
            dist = _dist;
            hueKey = scaleKey;
            newBaseColor = baseColorName as BaseColorKey;
          }
        });
    }
  );

  const new500Swatch = new Color(BASECOLOR.material[newBaseColor]);
  const newScale = materialScale(
    new500Swatch.hex,
    newBaseColor as BaseColorKey
  );
  const lchDiffs = getLchDifference(hex, newScale);

  /**
   * Save this for later. Potentially useful?
   *
   * TODO: Investigate
   */
  // determine which previously found key has the shortest distance to our input
  // const allDist = [lchDiffs.lightness.dist, lchDiffs.chroma.dist, dist];
  // const distKeys = [lchDiffs.lightness.key, lchDiffs.chroma.key, hueKey];
  // const shortestDist = allDist.reduce(
  //   (acc, cur) => (acc < cur ? acc : cur),
  //   360
  // );

  // key = distKeys[allDist.indexOf(shortestDist)];

  /**
   * overwrite key with lightness until I come up with a better approach as it
   * consistently gives the better results.
   */
  key = lchDiffs.lightness.key;

  /**
   * now that we have the "correct" key where our input belongs, we must find the
   * new "500" swatch.
   * To do this we calculate the diff in lch values of our input and the swatch
   * of the original palette which our input will replace.
   *
   * we then apply this diff to the new 500 swatch which we use to generate a
   * new scale.
   */
  const closestSwatch = new Color(newScale[key]);
  const swatchDiffs = color.lch.map((v, i) => v - closestSwatch.lch[i]);

  new500Swatch.lightness += swatchDiffs[0];
  new500Swatch.chroma += swatchDiffs[1];
  new500Swatch.hue += swatchDiffs[2];

  /**
   * This alternative methods returns a slightly different scale. not sure if
   * better or not.
   *
   * TODO: Investigate
   */
  // const keys = [
  //   "50",
  //   "100",
  //   "200",
  //   "300",
  //   "400",
  //   "500",
  //   "600",
  //   "700",
  //   "800",
  //   "900",
  // ];

  // const swatchValues = materialColorSchema[newBaseColor][keys.indexOf(key)];
  // const new500lch = [
  //   color.lch[0] - swatchValues[2],
  //   color.lch[1] - swatchValues[1],
  //   color.lch[2] - swatchValues[0],
  // ];
  // const new500 = new Color("lch", new500lch);
  // const finalScale = materialScale(new500.hex, newBaseColor);

  const finalScale = materialScale(new500Swatch.hex, newBaseColor);
  const finalDistances = getLchDifference(color.hex, finalScale);

  key = finalDistances.lightness.key;

  /*
   * Our current solution is not perfect.
   * This is a potential alternative solution to investigate in the future.
   *
   * TODO: Investigate
   */
  // const finalBaseColor = findClosestBaseColor(new500.hex);
  // const finalScale = materialScale(new500.hex, finalBaseColor.baseColor);

  return {
    scale: finalScale,
    key,
    baseColor: newBaseColor,
  };
}

/**
 * The real material palette seems to maintain its scale by changing which
 * swatch the inputted hex value is.
 * This way the material scale is "preserved" and doesn't generate off-putting
 * color palettes.
 */
function fluidScale(baseColorHexPair: BaseColorHexPair) {
  const { hex } = baseColorHexPair;
  const { scale, key, baseColor } = generateFluidScale(hex);

  // if the closest palette key to input hex is 500, just return the normal
  // scale.  It's already the best possible palette for this color.
  if (key === "500") {
    return materialScale(hex, baseColor);
  }

  const keyIndex = COLORKEYS.indexOf(key);

  if (keyIndex < 0) return materialScale(hex, baseColor);

  /**
   * jumping between hex and lch is not 100% accurate. So we trick the users by
   * replacing the swatch of the calculated key with the input.
   */
  scale[key] = hex;

  return scale;
}

/**
 * Generate a scale where the input hex is always key 500
 */
function lockedScale(hex: string) {
  const color = findClosestBaseColor(hex);
  const compressedColor = compressBasecolor(color);

  // return materialScale(hex, color.baseColor);
  return materialScale(hex, compressedColor);
}

export function generateMaterialPalette(
  baseColor: RgbHslHexObject,
  options: Options
): RgbHslHexObject[] {
  try {
    let palette;
    const color = findClosestBaseColor(baseColor.hex);

    if (options.lockSwatch) {
      palette = lockedScale(baseColor.hex);
    } else {
      palette = fluidScale(color);
    }

    return Object.keys(palette).map((key) => ({
      rgb: hexToRGB(palette[key], true),
      hsl: hexToHSL(palette[key]),
      hex: palette[key],
    }));
  } catch (e) {
    console.error("error: ", e);

    return undefined;
  }
}
