import * as THREE from 'three';
import { RoadPath } from './roadPath.js';
import { createRoadMesh } from './roadMesh.js';
import { TerrainField, createTerrainMesh } from '../world/terrain.js';
import { createScenery } from '../world/scenery.js';

/** Builds everything for one level: road path (for physics) + its 3D world. */
export function buildLevel(def, config) {
  const road = new RoadPath(def.segments);
  const field = new TerrainField(road);
  const group = new THREE.Group();
  group.name = `level-${def.id}`;
  group.add(createRoadMesh(road));
  group.add(createTerrainMesh(field, config.world));
  group.add(createScenery(road, field, config.world));
  group.visible = false;
  return { def, road, group, startIndex: 4 };
}
