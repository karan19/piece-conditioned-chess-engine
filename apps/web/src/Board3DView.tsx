import { useEffect, useMemo, useRef } from "react";
import type { Square } from "chess.js";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import {
  files,
  getBoardPieces,
  getCheckThreat,
  ranks,
  type BoardPiece,
  type createGame
} from "./chessGame";
import bishopDarkUrl from "./assets/chess-pieces/polyy-low-poly/models/06_bishop_dark_v2.glb?url";
import bishopLightUrl from "./assets/chess-pieces/polyy-low-poly/models/05_bishop_light_v2.glb?url";
import kingDarkUrl from "./assets/chess-pieces/polyy-low-poly/models/02_king_dark_v2.glb?url";
import kingLightUrl from "./assets/chess-pieces/polyy-low-poly/models/01_king_light_v2.glb?url";
import knightDarkUrl from "./assets/chess-pieces/polyy-low-poly/models/08_knight_dark_v2.glb?url";
import knightLightUrl from "./assets/chess-pieces/polyy-low-poly/models/07_knight_light_v2.glb?url";
import pawnDarkUrl from "./assets/chess-pieces/polyy-low-poly/models/12_pawn_dark_v2.glb?url";
import pawnLightUrl from "./assets/chess-pieces/polyy-low-poly/models/11_pawn_light_v2.glb?url";
import queenDarkUrl from "./assets/chess-pieces/polyy-low-poly/models/04_queen_dark_v2.glb?url";
import queenLightUrl from "./assets/chess-pieces/polyy-low-poly/models/03_queen_light_v2.glb?url";
import rookDarkUrl from "./assets/chess-pieces/polyy-low-poly/models/10_rook_dark_v2.glb?url";
import rookLightUrl from "./assets/chess-pieces/polyy-low-poly/models/09_rook_light_v2.glb?url";

type Board3DViewProps = {
  game: ReturnType<typeof createGame>;
  selectedSquare?: Square | null;
  legalDestinationSet?: Set<Square>;
  checkThreat?: ReturnType<typeof getCheckThreat>;
  isPreview?: boolean;
  onSquareClick?: (square: Square) => void;
};

const boardSize = 8;
const squareSize = 1;
const boardOffset = (boardSize * squareSize) / 2 - squareSize / 2;
const lightSquare = 0xe9e1d2;
const darkSquare = 0x9c5637;
const pieceModelFiles: Record<BoardPiece["type"], { w: string; b: string }> = {
  k: { w: kingLightUrl, b: kingDarkUrl },
  q: { w: queenLightUrl, b: queenDarkUrl },
  b: { w: bishopLightUrl, b: bishopDarkUrl },
  n: { w: knightLightUrl, b: knightDarkUrl },
  r: { w: rookLightUrl, b: rookDarkUrl },
  p: { w: pawnLightUrl, b: pawnDarkUrl }
};
const pieceScales: Record<BoardPiece["type"], number> = {
  k: 1.68,
  q: 1.46,
  b: 1.18,
  n: 1.13,
  r: 1.02,
  p: 0.9
};

const loader = new GLTFLoader();
const pieceModelCache = new Map<string, Promise<THREE.Group>>();

function pieceIdentity(piece: BoardPiece) {
  return `${piece.color}:${piece.type}:${piece.square}`;
}

function squareToPosition(square: Square) {
  const fileIndex = files.indexOf(square[0] as (typeof files)[number]);
  const rankIndex = ranks.indexOf(Number(square[1]) as (typeof ranks)[number]);

  return {
    x: fileIndex * squareSize - boardOffset,
    z: rankIndex * squareSize - boardOffset
  };
}

function getMoveAnimations(previousPieces: BoardPiece[] | null, currentPieces: BoardPiece[]) {
  const animations = new Map<Square, Square>();

  if (!previousPieces) {
    return animations;
  }

  const currentIdentitySet = new Set(currentPieces.map(pieceIdentity));
  const previousIdentitySet = new Set(previousPieces.map(pieceIdentity));
  const movedFromCandidates = previousPieces.filter((piece) => !currentIdentitySet.has(pieceIdentity(piece)));
  const movedToCandidates = currentPieces.filter((piece) => !previousIdentitySet.has(pieceIdentity(piece)));
  const consumedPreviousIndexes = new Set<number>();

  movedToCandidates.forEach((toPiece) => {
    const matchingIndex = movedFromCandidates.findIndex(
      (fromPiece, index) =>
        !consumedPreviousIndexes.has(index) &&
        fromPiece.color === toPiece.color &&
        fromPiece.type === toPiece.type
    );
    const promotionIndex =
      matchingIndex >= 0
        ? -1
        : movedFromCandidates.findIndex(
            (fromPiece, index) =>
              !consumedPreviousIndexes.has(index) &&
              fromPiece.color === toPiece.color &&
              fromPiece.type === "p"
          );
    const fromIndex = matchingIndex >= 0 ? matchingIndex : promotionIndex;

    if (fromIndex >= 0) {
      consumedPreviousIndexes.add(fromIndex);
      animations.set(toPiece.square, movedFromCandidates[fromIndex].square);
    }
  });

  return animations;
}

function getPieceModelUrl(piece: BoardPiece) {
  return pieceModelFiles[piece.type][piece.color];
}

function loadPieceModel(url: string) {
  const cachedModel = pieceModelCache.get(url);

  if (cachedModel) {
    return cachedModel;
  }

  const modelPromise = loader.loadAsync(url).then((gltf) => {
    const model = gltf.scene;

    model.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    return model;
  });

  pieceModelCache.set(url, modelPromise);
  return modelPromise;
}

async function createPieceMesh(piece: BoardPiece) {
  const sourceModel = await loadPieceModel(getPieceModelUrl(piece));
  const model = sourceModel.clone(true);
  const group = new THREE.Group();
  const position = squareToPosition(piece.square);
  const squareTopY = 0.055;

  model.traverse((child) => {
    child.userData.square = piece.square;
  });

  model.rotation.y = piece.color === "w" ? Math.PI : 0;
  model.scale.setScalar(pieceScales[piece.type]);
  model.updateMatrixWorld(true);

  const bounds = new THREE.Box3().setFromObject(model);
  model.position.y = squareTopY - bounds.min.y;
  group.add(model);
  group.position.set(position.x, 0, position.z);
  group.userData.square = piece.square;

  return group;
}

function createSquareMesh({
  square,
  isLight,
  isSelected,
  isLegalDestination,
  isKingThreat,
  isAttackerThreat
}: {
  square: Square;
  isLight: boolean;
  isSelected: boolean;
  isLegalDestination: boolean;
  isKingThreat: boolean;
  isAttackerThreat: boolean;
}) {
  const color = isKingThreat
    ? 0xd6473f
    : isAttackerThreat
      ? 0x319c64
      : isSelected
        ? 0xe8c34d
        : isLight
          ? lightSquare
          : darkSquare;
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.995, isSelected || isKingThreat || isAttackerThreat ? 0.16 : 0.11, 0.995),
    new THREE.MeshStandardMaterial({
      color,
      roughness: 0.58,
      metalness: 0.02
    })
  );
  const position = squareToPosition(square);

  mesh.position.set(position.x, 0, position.z);
  mesh.receiveShadow = true;
  mesh.userData.square = square;

  if (isLegalDestination && !isSelected) {
    const marker = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.16, 0.022, 32),
      new THREE.MeshStandardMaterial({
        color: 0x17463b,
        transparent: true,
        opacity: 0.72,
        roughness: 0.4
      })
    );
    marker.position.y = 0.072;
    marker.userData.square = square;
    mesh.add(marker);
  }

  return mesh;
}

function disposeSceneMeshes(object: THREE.Object3D) {
  object.traverse((child) => {
    if (child instanceof THREE.Mesh && !child.userData.isRoyalPieceModel) {
      child.geometry.dispose();
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      materials.forEach((material) => material.dispose());
    }
  });
}

export function Board3DView({
  game,
  selectedSquare,
  legalDestinationSet,
  checkThreat,
  isPreview,
  onSquareClick
}: Board3DViewProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const clickHandlerRef = useRef(onSquareClick);
  const previousBoardPiecesRef = useRef<BoardPiece[] | null>(null);
  const boardPieces = useMemo(() => getBoardPieces(game), [game]);
  const attackerSquares = useMemo(
    () => new Set(checkThreat?.attackers.map((attacker) => attacker.square) ?? []),
    [checkThreat]
  );

  useEffect(() => {
    clickHandlerRef.current = onSquareClick;
  }, [onSquareClick]);

  useEffect(() => {
    const mountElement = mountRef.current;

    if (!mountElement) {
      return;
    }

    let wasCancelled = false;
    const mount = mountElement;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf8faf9);

    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    mount.replaceChildren(renderer.domElement);

    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    camera.position.set(0, 14.4, 11.4);
    camera.lookAt(0, 0, 0.35);

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const interactiveObjects: THREE.Object3D[] = [];
    const moveAnimations = getMoveAnimations(previousBoardPiecesRef.current, boardPieces);
    previousBoardPiecesRef.current = boardPieces;

    scene.add(new THREE.HemisphereLight(0xffffff, 0xe7d3bf, 2.2));

    const keyLight = new THREE.DirectionalLight(0xffffff, 2.6);
    keyLight.position.set(-3.5, 8.5, 5.5);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(2048, 2048);
    keyLight.shadow.camera.left = -6;
    keyLight.shadow.camera.right = 6;
    keyLight.shadow.camera.top = 6;
    keyLight.shadow.camera.bottom = -6;
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xffffff, 1.3);
    fillLight.position.set(5.5, 5.5, -4.5);
    scene.add(fillLight);

    const boardBase = new THREE.Mesh(
      new THREE.BoxGeometry(8.55, 0.18, 8.55),
      new THREE.MeshStandardMaterial({
        color: 0x5a3322,
        roughness: 0.62,
        metalness: 0.08
      })
    );
    boardBase.position.y = -0.14;
    boardBase.receiveShadow = true;
    scene.add(boardBase);

    const underlay = new THREE.Mesh(
      new THREE.PlaneGeometry(11.5, 11.5),
      new THREE.ShadowMaterial({ opacity: 0.16 })
    );
    underlay.rotation.x = -Math.PI / 2;
    underlay.position.y = -0.26;
    underlay.receiveShadow = true;
    scene.add(underlay);

    files.forEach((file, fileIndex) => {
      ranks.forEach((rank, rankIndex) => {
        const square = `${file}${rank}` as Square;
        const squareMesh = createSquareMesh({
          square,
          isLight: (fileIndex + rankIndex) % 2 === 0,
          isSelected: selectedSquare === square,
          isLegalDestination: legalDestinationSet?.has(square) ?? false,
          isKingThreat: checkThreat?.kingSquare === square,
          isAttackerThreat: attackerSquares.has(square)
        });
        scene.add(squareMesh);
        interactiveObjects.push(squareMesh);
      });
    });

    function render() {
      renderer.render(scene, camera);
    }

    function resize() {
      const rect = mount.getBoundingClientRect();
      const width = Math.max(rect.width, 320);
      const height = Math.max(rect.height, 320);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      render();
    }

    function handlePointerDown(event: PointerEvent) {
      if (isPreview) {
        return;
      }

      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(interactiveObjects, true)[0];
      const square = hit?.object.userData.square ?? hit?.object.parent?.userData.square;

      if (square) {
        clickHandlerRef.current?.(square as Square);
      }
    }

    resize();
    renderer.domElement.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("resize", resize);

    Promise.all(boardPieces.map((piece) => createPieceMesh(piece))).then((pieceMeshes) => {
      if (wasCancelled) {
        return;
      }

      const activeAnimations: Array<{
        mesh: THREE.Group;
        start: THREE.Vector3;
        end: THREE.Vector3;
        startedAt: number;
        durationMs: number;
        lift: number;
      }> = [];

      pieceMeshes.forEach((pieceMesh, index) => {
        const piece = boardPieces[index];
        const fromSquare = moveAnimations.get(piece.square);
        const targetPosition = pieceMesh.position.clone();

        if (fromSquare) {
          const fromPosition = squareToPosition(fromSquare);
          pieceMesh.position.set(fromPosition.x, targetPosition.y, fromPosition.z);
          activeAnimations.push({
            mesh: pieceMesh,
            start: pieceMesh.position.clone(),
            end: targetPosition,
            startedAt: performance.now(),
            durationMs: piece.type === "b" || piece.type === "n" ? 1050 : 850,
            lift: piece.type === "b" || piece.type === "n" ? 0.52 : 0.16
          });
        }

        pieceMesh.traverse((child) => {
          child.userData.isRoyalPieceModel = true;
        });
        scene.add(pieceMesh);
        interactiveObjects.push(pieceMesh);
      });

      if (!activeAnimations.length) {
        render();
        return;
      }

      function animateMoveFrame(now: number) {
        if (wasCancelled) {
          return;
        }

        const unfinishedAnimations = activeAnimations.filter((animation) => {
          const progress = Math.min((now - animation.startedAt) / animation.durationMs, 1);
          const easedProgress = 1 - Math.pow(1 - progress, 3);
          animation.mesh.position.lerpVectors(animation.start, animation.end, easedProgress);
          animation.mesh.position.y =
            animation.end.y + Math.sin(Math.PI * progress) * animation.lift;

          return progress < 1;
        });

        render();

        if (unfinishedAnimations.length) {
          window.requestAnimationFrame(animateMoveFrame);
        }
      }

      window.requestAnimationFrame(animateMoveFrame);
    });

    return () => {
      wasCancelled = true;
      window.removeEventListener("resize", resize);
      renderer.domElement.removeEventListener("pointerdown", handlePointerDown);
      disposeSceneMeshes(scene);
      renderer.dispose();
      mount.replaceChildren();
    };
  }, [
    attackerSquares,
    boardPieces,
    checkThreat,
    isPreview,
    legalDestinationSet,
    selectedSquare
  ]);

  return (
    <div
      aria-label="Fixed 3D chessboard"
      className="board-3d-frame"
      ref={mountRef}
      role="img"
    />
  );
}
