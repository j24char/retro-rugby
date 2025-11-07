import React, { useState } from "react";
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
const BALL_TOSS_DISTANCE = 50;

// Control layout
const JOYSTICK_RADIUS = 100;
const JOYSTICK_X = 120;
const JOYSTICK_Y = SCREEN_HEIGHT - 120;
const JOYSTICK_KNOB_RADIUS = 20;

const BALL_UP_RADIUS = 40;
const BALL_UP_X = SCREEN_WIDTH - 60;
const BALL_UP_Y = SCREEN_HEIGHT - 165;

const BALL_DOWN_RADIUS = 40;
const BALL_DOWN_X = SCREEN_WIDTH - 60;
const BALL_DOWN_Y = SCREEN_HEIGHT - 75;

const PlayerRenderer = ({ x, y, r, fill }) => (
  <Svg style={StyleSheet.absoluteFill}>
    <Circle cx={x} cy={y} r={r} fill={fill} />
  </Svg>
);

export default function App() {
  // --- Game state ---
  const [entities, setEntities] = useState({
    player: { x: PLAYER_START_X, y: PLAYER_START_Y, r: PLAYER_RADIUS, fill: "red", renderer: <PlayerRenderer /> },
    ball: { x: 100, y: SCREEN_HEIGHT / 2 - 30, r: BALL_RADIUS, fill: "yellow", renderer: <PlayerRenderer /> },
    opponent: { x: OPPONENT_START_X, y: OPPONENT_START_Y, r: OPPONENT_RADIUS, fill: "green", renderer: <PlayerRenderer /> },
  });

  const [opponentDir, setOpponentDir] = useState(1);
  const [joystick, setJoystick] = useState({ dx: 0, dy: 0 });
  const [knobPos, setKnobPos] = useState({ x: JOYSTICK_X, y: JOYSTICK_Y });

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderGrant: (evt) => handleJoystick(evt.nativeEvent),
    onPanResponderMove: (evt) => handleJoystick(evt.nativeEvent),
    onPanResponderRelease: () => {
      setJoystick({ dx: 0, dy: 0 });
      setKnobPos({ x: JOYSTICK_X, y: JOYSTICK_Y });
    },
  });

  const handleJoystick = (touch) => {
    const dx = touch.locationX - JOYSTICK_X;
    const dy = touch.locationY - JOYSTICK_Y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // if (distance <= JOYSTICK_RADIUS) {
    //   // Scale speed proportionally to distance
    //   const scale = Math.min(distance / JOYSTICK_RADIUS, 1);
    //   setJoystick({ dx: (dx / distance) * scale * PLAYER_MAX_SPEED, dy: (dy / distance) * scale * PLAYER_MAX_SPEED });
    // }
    if (distance <= JOYSTICK_RADIUS) {
      const scale = Math.min(distance / JOYSTICK_RADIUS, 1);
      const dxSpeed = (dx / distance) * scale * PLAYER_MAX_SPEED;
      const dySpeed = (dy / distance) * scale * PLAYER_MAX_SPEED;
      setJoystick({ dx: dxSpeed, dy: dySpeed });

      // Update knob position proportionally
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
    const speed = PLAYER_SPEED;

    // Smooth analog movement
    newEntities.player.x = Math.max(PLAYER_RADIUS, Math.min(SCREEN_WIDTH - PLAYER_RADIUS, newEntities.player.x + joystick.dx));
    newEntities.player.y = Math.max(PLAYER_RADIUS, Math.min(SCREEN_HEIGHT - PLAYER_RADIUS, newEntities.player.y + joystick.dy));

    // Ball follows player if not tossed
    newEntities.ball.x = newEntities.player.x;
    newEntities.ball.y = newEntities.player.y + 5;

    // Opponent movement
    newEntities.opponent.y += opponentDir * OPPONENT_SPEED;
    if (newEntities.opponent.y < 80 || newEntities.opponent.y > SCREEN_HEIGHT - 160) setOpponentDir(-opponentDir);

    setEntities(newEntities);
    return newEntities;
  };

  const handleBallControl = (touchX, touchY) => {
    if (touchX > SCREEN_WIDTH * 0.7 && touchY > SCREEN_HEIGHT * 0.6) {
      const relativeY = touchY - SCREEN_HEIGHT * 0.6;
      if (relativeY < 40) {
        // toss ball up
        setEntities((prev) => ({ ...prev, ball: { ...prev.ball, y: prev.ball.y - BALL_TOSS_DISTANCE } }));
      } else {
        // toss ball down
        setEntities((prev) => ({ ...prev, ball: { ...prev.ball, y: prev.ball.y + BALL_TOSS_DISTANCE } }));
      }
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
          {/* Lower-left joystick */}
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
