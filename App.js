import React, { useEffect, useRef, useState } from "react";
import { View, StyleSheet, Dimensions, PanResponder } from "react-native";
import { GameEngine } from "react-native-game-engine";
import Svg, { Circle } from "react-native-svg";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// --- Game constants ---
const PLAYER_RADIUS = 20;
const BALL_RADIUS = 10;
const OPPONENT_RADIUS = 20;
const PLAYER_START_X = 100;
const PLAYER_START_Y = SCREEN_HEIGHT / 2;
const OPPONENT_START_X = SCREEN_WIDTH - 40;
const OPPONENT_START_Y = SCREEN_HEIGHT / 2;
const PLAYER_SPEED = 5;
const PLAYER_MAX_SPEED = 5;
const OPPONENT_SPEED = 3;
const BALL_TOSS_DISTANCE = 150;
const BALL_TOSS_DURATION = 40; // frames for toss animation
const TRAIL_LENGTH = 5;
const PICKUP_RADIUS = 30;

// Joystick area
const JOYSTICK_RADIUS = 100;
const JOYSTICK_X = 120;
const JOYSTICK_Y = SCREEN_HEIGHT - 120;
const JOYSTICK_KNOB_RADIUS = 20;

// Ball control circles
const BALL_UP_RADIUS = 40;
const BALL_UP_X = SCREEN_WIDTH - 60;
const BALL_UP_Y = SCREEN_HEIGHT - 165;

const BALL_DOWN_RADIUS = 40;
const BALL_DOWN_X = SCREEN_WIDTH - 60;
const BALL_DOWN_Y = SCREEN_HEIGHT - 75;

// --- Renderer ---
const PlayerRenderer = ({ x, y, r, fill }) => (
  <Svg style={StyleSheet.absoluteFill}>
    <Circle cx={x} cy={y} r={r} fill={fill} />
  </Svg>
);

export default function App() {
  // --- Game state ---
  const [entities, setEntities] = useState({
    player: { x: PLAYER_START_X, y: PLAYER_START_Y, r: PLAYER_RADIUS, fill: "red", renderer: <PlayerRenderer /> },
    ball: { x: PLAYER_START_X, y: PLAYER_START_Y - 30, r: BALL_RADIUS, fill: "yellow", renderer: <PlayerRenderer /> },
    opponent: { x: OPPONENT_START_X, y: OPPONENT_START_Y, r: OPPONENT_RADIUS, fill: "green", renderer: <PlayerRenderer /> },
  });

  const [opponentDir, setOpponentDir] = useState(1);
  const [joystick, setJoystick] = useState({ dx: 0, dy: 0 });
  const [knobPos, setKnobPos] = useState({ x: JOYSTICK_X, y: JOYSTICK_Y });
  const [playerHasBall, setPlayerHasBall] = useState(true);
  const ballTrail = useRef([]); // Store recent ball positions for the trail
  const [move, setMove] = useState({ x: 0, y: 0 });
  const [trail, setTrail] = useState([]);
  const joystickFinger = useRef(null);


  // Toss animation state
  const tossRef = useRef({
    active: false,
    direction: null,
    frame: 0,
    startX: 0,
    startY: 0,
    targetX: 0,
    targetY: 0,
  });

  // Helper: circle hit test
  const pointInCircle = (px, py, cx, cy, r) => {
    const dx = px - cx;
    const dy = py - cy;
    return dx * dx + dy * dy <= r * r;
  };

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,

    onPanResponderGrant: (evt) => {
      for (let touch of evt.nativeEvent.touches) {
        const x = touch.locationX;
        const y = touch.locationY;

        const dx = x - JOYSTICK_X;
        const dy = y - JOYSTICK_Y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const insideJoystick = distance < JOYSTICK_RADIUS;
        const inTossArea = x > SCREEN_WIDTH * 0.6 && y > SCREEN_HEIGHT * 0.6;

        if (insideJoystick && joystickFinger.current === null) {
          joystickFinger.current = touch.identifier;
          handleJoystick(touch);
        }

        if (inTossArea) {
          handleBallControl(x, y); // toss immediately
        }
      }
    },

    onPanResponderMove: (evt) => {
      const joyID = joystickFinger.current;

      // If joystick finger is gone but didn't trigger release properly, reset it
      const stillPressed = evt.nativeEvent.touches.some(t => t.identifier === joyID);

      if (!stillPressed && joyID !== null) {
        joystickFinger.current = null;
        setJoystick({ dx: 0, dy: 0 });
        setKnobPos({ x: JOYSTICK_X, y: JOYSTICK_Y });
        return;
      }

      // Continue joystick movement
      if (joyID !== null) {
        const joyTouch = evt.nativeEvent.touches.find(t => t.identifier === joyID);
        if (joyTouch) {
          const dx = joyTouch.locationX - JOYSTICK_X;
          const dy = joyTouch.locationY - JOYSTICK_Y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          if (distance < JOYSTICK_RADIUS) handleJoystick(joyTouch);
        }
      }
    },

    onPanResponderRelease: (evt) => {
      const joyID = joystickFinger.current;

      // If the joystick finger is one of the released ones → reset
      const releasedIDs = evt.nativeEvent.changedTouches.map(t => t.identifier);

      if (releasedIDs.includes(joyID)) {
        joystickFinger.current = null;
        setJoystick({ dx: 0, dy: 0 });
        setKnobPos({ x: JOYSTICK_X, y: JOYSTICK_Y });
      }

      // If NO touches are left, always reset joystick
      if (evt.nativeEvent.touches.length === 0) {
        joystickFinger.current = null;
        setJoystick({ dx: 0, dy: 0 });
        setKnobPos({ x: JOYSTICK_X, y: JOYSTICK_Y });
      }
    },
  });



  const handleJoystick = (touch) => {
    const dx = touch.locationX - JOYSTICK_X;
    const dy = touch.locationY - JOYSTICK_Y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance <= JOYSTICK_RADIUS) {
      const scale = Math.min(distance / JOYSTICK_RADIUS, 1);
      // avoid divide-by-zero
      const nx = distance === 0 ? 0 : dx / distance;
      const ny = distance === 0 ? 0 : dy / distance;
      const dxSpeed = nx * scale * PLAYER_MAX_SPEED;
      const dySpeed = ny * scale * PLAYER_MAX_SPEED;
      setJoystick({ dx: dxSpeed, dy: dySpeed });

      // Knob position proportional to distance
      const knobDistance = Math.min(distance, JOYSTICK_RADIUS - JOYSTICK_KNOB_RADIUS);
      const angle = Math.atan2(dy, dx);
      setKnobPos({
        x: JOYSTICK_X + knobDistance * Math.cos(angle),
        y: JOYSTICK_Y + knobDistance * Math.sin(angle),
      });
    }
  };

  // --- Game update ---
  const UpdateSystem = () => {
    const newEntities = { ...entities };

    // Move player
    newEntities.player.x = Math.max(PLAYER_RADIUS, Math.min(SCREEN_WIDTH - PLAYER_RADIUS, newEntities.player.x + joystick.dx));
    newEntities.player.y = Math.max(PLAYER_RADIUS, Math.min(SCREEN_HEIGHT - PLAYER_RADIUS, newEntities.player.y + joystick.dy));

    // Toss animation (if active)
    if (tossRef.current.active) {
      const frame = tossRef.current.frame;
      const duration = BALL_TOSS_DURATION;
      const t = Math.min(frame / duration, 1);
      const ease = 1 - Math.pow(1 - t, 3);
      const x = tossRef.current.startX + (tossRef.current.targetX - tossRef.current.startX) * ease;
      const y = tossRef.current.startY + (tossRef.current.targetY - tossRef.current.startY) * ease - Math.sin(t * Math.PI) * 40;

      newEntities.ball.x = x;
      newEntities.ball.y = y;

      tossRef.current.frame++;

      if (tossRef.current.frame >= duration) {
        tossRef.current.active = false;
        // ball lands, remains independent
      }
    } else {
      // Ball follows player only if playerHasBall === true
      if (playerHasBall) {
        newEntities.ball.x = newEntities.player.x;
        newEntities.ball.y = newEntities.player.y - 30;
      } else {
        // Check if player is close enough to pick up the ball
        const dx = newEntities.player.x - newEntities.ball.x;
        const dy = newEntities.player.y - newEntities.ball.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < PICKUP_RADIUS) {
          setPlayerHasBall(true);
        }
      }
    }


    // Opponent movement
    newEntities.opponent.y += opponentDir * OPPONENT_SPEED;
    if (newEntities.opponent.y < 80 || newEntities.opponent.y > SCREEN_HEIGHT - 160) setOpponentDir(-opponentDir);

    setEntities(newEntities);
    return newEntities;
  };

  const handleBallControl = (touchX, touchY) => {
    if (tossRef.current.active) return;

    if (touchX > SCREEN_WIDTH * 0.6 && touchY > SCREEN_HEIGHT * 0.6) {
      const tossDirection = touchY < BALL_UP_Y ? "up" : "down";

      const latestBallX = entities.ball.x;
      const latestBallY = entities.ball.y;

      tossRef.current = {
        active: true,
        direction: tossDirection,
        frame: 0,
        startX: latestBallX,
        startY: latestBallY,
        targetX: latestBallX,
        targetY:
          tossDirection === "up"
            ? latestBallY - BALL_TOSS_DISTANCE
            : latestBallY + BALL_TOSS_DISTANCE,
      };

      setPlayerHasBall(false);
    }
  };

  const handleTouch = (evt) => {
    handleBallControl(evt.nativeEvent.locationX, evt.nativeEvent.locationY);
  };

  return (
    
    <View style={styles.container} {...panResponder.panHandlers}>
      <GameEngine style={styles.gameContainer} systems={[UpdateSystem]} entities={entities}>
        {/* Draw control circles */}
        <Svg style={StyleSheet.absoluteFill}>
          {/* Trail */}
          {trail.map((pos, i) => (
            <Circle
              key={i}
              cx={pos.x}
              cy={pos.y}
              r={PLAYER_RADIUS - i * 3}
              fill={`rgba(255,0,0,${0.3 - i * 0.05})`}
            />
          ))}

          {/* Ball shadow while tossing */}
          {tossRef.current.active && (
          <Circle
              cx={entities.ball.x + 5}
              cy={entities.ball.y + 10}
            r={BALL_RADIUS}
              fill="rgba(0,0,0,0.2)"
          />
          )}

          {/* Player / ball / opponent renderers */}
          <Circle cx={entities.player.x} cy={entities.player.y} r={entities.player.r} fill={entities.player.fill} />
          <Circle cx={entities.ball.x} cy={entities.ball.y} r={entities.ball.r} fill={entities.ball.fill} />
          <Circle cx={entities.opponent.x} cy={entities.opponent.y} r={entities.opponent.r} fill={entities.opponent.fill} />

          {/* Lower-left joystick base */}
          <Circle cx={JOYSTICK_X} cy={JOYSTICK_Y} r={JOYSTICK_RADIUS} fill="rgba(255,255,255,0.2)" />
          {/* Joystick knob */}
          <Circle cx={knobPos.x} cy={knobPos.y} r={JOYSTICK_KNOB_RADIUS} fill="rgba(255,255,255,0.5)" />
          {/* Lower-right top (ball toss up) */}
          <Circle cx={BALL_UP_X} cy={BALL_UP_Y} r={BALL_UP_RADIUS} fill="rgba(255,255,255,0.2)" />
          {/* Lower-right bottom (ball toss down) */}
          <Circle cx={BALL_DOWN_X} cy={BALL_DOWN_Y} r={BALL_DOWN_RADIUS} fill="rgba(255,255,255,0.2)" />
        </Svg>
      </GameEngine>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#08b75c" },
  gameContainer: { flex: 1 },
});
