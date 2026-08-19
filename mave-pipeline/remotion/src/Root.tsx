import React from 'react';
import { Composition } from 'remotion';
import { FP2RacePaceVideo } from './compositions/FP2RacePaceVideo';
import { QualiForensicsVideo } from './compositions/QualiForensicsVideo';
import { SprintRaceVideo } from './compositions/SprintRaceVideo';
import { PreRaceStrategyVideo } from './compositions/PreRaceStrategyVideo';
import { RaceAutopsyVideo } from './compositions/RaceAutopsyVideo';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* 1. FORMAT 1: FP2 RACE PACE VERDICT (25s @ 60fps = 1500 frames) */}
      <Composition
        id="FP2RacePaceVideo"
        component={FP2RacePaceVideo}
        durationInFrames={1500}
        fps={60}
        width={1080}
        height={1920}
      />

      {/* 2. FORMAT 2: WHERE POLE WAS WON & SPRINT SHOOTOUT (25s @ 60fps = 1500 frames) */}
      <Composition
        id="QualiForensicsVideo"
        component={QualiForensicsVideo}
        durationInFrames={1500}
        fps={60}
        width={1080}
        height={1920}
      />

      {/* 3. FORMAT 3: 100KM SPRINT RACE AUTOPSY (25s @ 60fps = 1500 frames) */}
      <Composition
        id="SprintRaceVideo"
        component={SprintRaceVideo}
        durationInFrames={1500}
        fps={60}
        width={1080}
        height={1920}
      />

      {/* 4. FORMAT 4: PRE-RACE STRATEGY ALERT (30s @ 60fps = 1800 frames) */}
      <Composition
        id="PreRaceStrategyVideo"
        component={PreRaceStrategyVideo}
        durationInFrames={1800}
        fps={60}
        width={1080}
        height={1920}
      />

      {/* 5. FORMAT 5: POST-RACE STRATEGY AUTOPSY (30s @ 60fps = 1800 frames) */}
      <Composition
        id="RaceAutopsyVideo"
        component={RaceAutopsyVideo}
        durationInFrames={1800}
        fps={60}
        width={1080}
        height={1920}
      />
    </>
  );
};
