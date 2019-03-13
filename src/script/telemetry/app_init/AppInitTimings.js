/*
 * Wire
 * Copyright (C) 2018 Wire Swiss GmbH
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see http://www.gnu.org/licenses/.
 *
 */

import {isNumber, isString} from 'underscore';
import Logger from 'utils/Logger';
import TimeUtil from 'utils/TimeUtil';

import AppInitTimingsStep from './AppInitTimingsStep';

export default class AppInitTimings {
  static get CONFIG() {
    return {
      BUCKET_SIZE: 10,
      LOG_LENGTH_KEY: 27,
      LOG_LENGTH_VALUE: 6,
    };
  }

  constructor() {
    this.logger = Logger('AppInitTimings');
    this.init = window.performance.now();
  }

  get() {
    const timings = {};

    Object.entries(this).forEach(([key, value]) => {
      if (key.toString() !== 'init' && _.isNumber(value)) {
        timings[key] = value;
      }
    });

    return timings;
  }

  get_app_load() {
    const CONFIG = AppInitTimings.CONFIG;
    const appLoaded = this[AppInitTimingsStep.APP_LOADED];
    const appLoadedInSeconds = appLoaded / TimeUtil.UNITS_IN_MILLIS.SECOND;

    return (Math.floor(appLoadedInSeconds / CONFIG.BUCKET_SIZE) + 1) * CONFIG.BUCKET_SIZE;
  }

  log() {
    const statsData = Object.entries(this).reduce((stats, [key, value]) => {
      return isNumber(value) || isString(value) ? {...stats, [key]: value} : stats;
    }, {});
    this.logger.debug('App initialization step durations', statsData);
  }

  time_step(step) {
    if (!this[step]) {
      return (this[step] = window.parseInt(window.performance.now() - this.init));
    }
  }
}
