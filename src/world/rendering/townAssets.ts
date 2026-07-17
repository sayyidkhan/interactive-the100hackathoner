import * as THREE from "three";
import type { TownAsset } from "../../data/townSchema";
import {
  addBuilding,
  addCommunityBoard,
  addMarket,
  addMarketBooth,
  addMarketLawn,
  addParcelCart
} from "./buildings";
import {
  addFountain,
  addLoopMonument,
  addTownWelcomeSign,
  addTree,
  addWaterTower
} from "./landmarks";
import {
  addBench,
  addFence,
  addFlowerBed,
  addGardenPlot,
  addGrassClump,
  addLamp,
  addPicnicLawn,
  addPicnicTable,
  addRock,
  addShrub,
  addTinyFlag
} from "./props";
import { TOWN_SPREAD } from "../worldConstants";

export {
  addLandscapeDetails,
  addPath,
  addPathStones,
  addPerimeterWalls,
  addWaterfront
} from "./environment";

export function renderTownAssets(layer: THREE.Group, assets: TownAsset[]): void {
  for (const asset of assets) {
    const root = new THREE.Group();
    const scene = root as unknown as THREE.Scene;
    root.name = `asset:${asset.id}`;
    root.userData.schemaAssetId = asset.id;
    root.userData.schemaAssetType = asset.type;
    root.userData.builderSelectable = true;
    layer.add(root);

    const [x, z] = asset.position;
    if (asset.lawn) {
      const [lawnX, lawnZ] = asset.lawn.position;
      addMarketLawn(scene, lawnX, lawnZ, asset.lawn.width, asset.lawn.depth);
    }

    switch (asset.type) {
      case "building":
        addBuilding(scene, asset.label ?? "Building", x, z, asset.color ?? "#a6a19a", asset.roofColor ?? "#805c48");
        break;
      case "market":
        addMarket(scene, asset.label ?? "Market", x, z, asset.color ?? "#d9bd7b");
        break;
      case "booth":
        addMarketBooth(scene, x, z, asset.label ?? "Market booth", asset.color ?? "#d5745c", asset.stripeColor ?? "#f2ead8");
        break;
      case "parcelCart":
        addParcelCart(scene, x, z, 0);
        break;
      case "communityBoard":
        addCommunityBoard(scene, x, z, 0);
        break;
      case "welcomeSign":
        addTownWelcomeSign(scene, x, z);
        break;
      case "fountain":
        addFountain(scene, x, z);
        break;
      case "monument":
        addLoopMonument(scene, x, z);
        break;
      case "waterTower":
        addWaterTower(scene, x, z);
        break;
      case "tree":
        addTree(scene, x, z, asset.variant ?? 0);
        break;
      case "lamp":
        addLamp(scene, x, z);
        break;
      case "shrub":
        addShrub(scene, x, z, 1);
        break;
      case "picnicTable":
        addPicnicLawn(scene, x, z, 0);
        addPicnicTable(scene, x, z, 0);
        break;
      case "bench":
        addBench(scene, x, z, 0);
        break;
      case "flowerBed":
        addFlowerBed(scene, x, z, asset.color ?? "#f2b35f");
        break;
      case "fence":
        addFence(scene, x, z, 4.8, 0);
        break;
      case "rock":
        addRock(scene, x, z, 1);
        break;
      case "tinyFlag":
        addTinyFlag(scene, x, z, asset.color ?? "#2e6f72");
        break;
      case "gardenPlot":
        addGardenPlot(scene, x, z, 0);
        break;
      case "grassClump":
        addGrassClump(scene, x, z, 1);
        break;
    }

    root.position.set(x * TOWN_SPREAD, 0, z * TOWN_SPREAD);
    for (const object of root.children) {
      object.position.x = (object.position.x - x) * TOWN_SPREAD;
      object.position.z = (object.position.z - z) * TOWN_SPREAD;
    }
    root.rotation.y = asset.rotation ?? 0;
    root.scale.setScalar(asset.scale ?? 1);
  }
}
