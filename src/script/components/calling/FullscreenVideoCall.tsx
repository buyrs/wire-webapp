/*
 * Wire
 * Copyright (C) 2020 Wire Swiss GmbH
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

import {css} from '@emotion/react';
import {CALL_TYPE, CONV_TYPE} from '@wireapp/avs';
import {WebAppEvents} from '@wireapp/webapp-events';
import {amplify} from 'amplify';
import Icon from 'Components/Icon';
import React, {useEffect, useMemo, useState} from 'react';
import {TeamState} from '../../team/TeamState';
import {container} from 'tsyringe';
import {useKoSubscribableChildren} from 'Util/ComponentUtil';
import {TIME_IN_MILLIS} from 'Util/TimeUtil';
import type {Call} from '../../calling/Call';
import type {Participant} from '../../calling/Participant';
import type {Grid} from '../../calling/videoGridHandler';
import type {Conversation} from '../../entity/Conversation';
import {MuteState} from '../../calling/CallState';
import useHideElement from '../../hooks/useHideElement';
import {DeviceTypes, ElectronDesktopCapturerSource, MediaDevicesHandler} from '../../media/MediaDevicesHandler';
import type {Multitasking} from '../../notification/NotificationRepository';
import {t} from '../../util/LocalizerUtil';
import {CallViewTab, CallViewTabs} from '../../view_model/CallingViewModel';
import ButtonGroup from './ButtonGroup';
import DeviceToggleButton from './DeviceToggleButton';
import Duration from './Duration';
import GroupVideoGrid from './GroupVideoGrid';
import Pagination from './Pagination';
import ClassifiedBar from 'Components/input/ClassifiedBar';
import {KEY} from 'Util/KeyboardUtil';
import {preventFocusOutside} from 'Util/util';
import {
  videoControlActiveStyles,
  videoControlInActiveStyles,
  videoControlDisabledStyles,
  paginationButtonStyles,
} from './FullscreenVideoCallStyles';

export interface FullscreenVideoCallProps {
  activeCallViewTab: string;
  call: Call;
  canShareScreen: boolean;
  changePage: (newPage: number, call: Call) => void;
  conversation: Conversation;
  isChoosingScreen: boolean;
  isMuted: boolean;
  leave: (call: Call) => void;
  maximizedParticipant: Participant;
  mediaDevicesHandler: MediaDevicesHandler;
  multitasking: Multitasking;
  muteState: MuteState;
  setActiveCallViewTab: (tab: string) => void;
  setMaximizedParticipant: (call: Call, participant: Participant) => void;
  switchCameraInput: (call: Call, deviceId: string) => void;
  teamState?: TeamState;
  toggleCamera: (call: Call) => void;
  toggleMute: (call: Call, muteState: boolean) => void;
  toggleScreenshare: (call: Call) => void;
  videoGrid: Grid;
}

const FullscreenVideoCallConfig = {
  HIDE_CONTROLS_TIMEOUT: TIME_IN_MILLIS.SECOND * 4,
};

const FullscreenVideoCall: React.FC<FullscreenVideoCallProps> = ({
  call,
  canShareScreen,
  conversation,
  isChoosingScreen,
  isMuted,
  muteState,
  mediaDevicesHandler,
  multitasking,
  videoGrid,
  maximizedParticipant,
  activeCallViewTab,
  switchCameraInput,
  setMaximizedParticipant,
  setActiveCallViewTab,
  toggleMute,
  toggleCamera,
  toggleScreenshare,
  leave,
  changePage,
  teamState = container.resolve(TeamState),
}) => {
  const selfParticipant = call.getSelfParticipant();
  const {sharesScreen: selfSharesScreen, sharesCamera: selfSharesCamera} = useKoSubscribableChildren(selfParticipant, [
    'sharesScreen',
    'sharesCamera',
  ]);

  const {
    activeSpeakers,
    currentPage,
    pages: callPages,
    startedAt,
    participants,
  } = useKoSubscribableChildren(call, ['activeSpeakers', 'currentPage', 'pages', 'startedAt', 'participants']);
  const {display_name: conversationName, participating_user_ets: conversationParticipants} = useKoSubscribableChildren(
    conversation,
    ['display_name', 'participating_user_ets'],
  );
  const {isVideoCallingEnabled, classifiedDomains} = useKoSubscribableChildren(teamState, [
    'isVideoCallingEnabled',
    'classifiedDomains',
  ]);

  const {videoInput: currentCameraDevice} = useKoSubscribableChildren(mediaDevicesHandler.currentDeviceId, [
    DeviceTypes.VIDEO_INPUT,
  ]);
  const minimize = () => multitasking.isMinimized(true);
  const {videoInput} = useKoSubscribableChildren(mediaDevicesHandler.availableDevices, [DeviceTypes.VIDEO_INPUT]);
  const showToggleVideo =
    isVideoCallingEnabled &&
    (call.initialType === CALL_TYPE.VIDEO ||
      conversation.supportsVideoCall(call.conversationType === CONV_TYPE.CONFERENCE));
  const availableCameras = useMemo(
    () =>
      videoInput.map(device => (device as MediaDeviceInfo).deviceId || (device as ElectronDesktopCapturerSource).id),
    [videoInput],
  );
  const showSwitchCamera = selfSharesCamera && availableCameras.length > 1;
  const setWrapper = useHideElement(FullscreenVideoCallConfig.HIDE_CONTROLS_TIMEOUT, 'video-controls__button');

  const [hasUnreadMessages, setHasUnreadMessages] = useState(false);
  const updateUnreadCount = (unreadCount: number) => setHasUnreadMessages(unreadCount > 0);
  useEffect(() => {
    amplify.subscribe(WebAppEvents.LIFECYCLE.UNREAD_COUNT, updateUnreadCount);
    return () => amplify.unsubscribe(WebAppEvents.LIFECYCLE.UNREAD_COUNT, updateUnreadCount);
  }, []);

  const totalPages = callPages.length;

  const isSpaceOrEnterKey = (event: React.KeyboardEvent<HTMLDivElement>) => {
    return event.key === KEY.ENTER || event.key === KEY.SPACE;
  };

  const handleToggleCameraKeydown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (isSpaceOrEnterKey(event)) {
      toggleCamera(call);
    }
    return true;
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      preventFocusOutside(event, 'video-calling');
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  return (
    <div id="video-calling" className="video-calling" ref={setWrapper}>
      <div id="video-title" className="video-title">
        {classifiedDomains && (
          <ClassifiedBar
            users={conversationParticipants}
            classifiedDomains={classifiedDomains}
            style={{
              display: 'inline-block',
              left: '12px',
              lineHeight: '1.5em',
              margin: '1em 0',
              padding: '0 1em',
              position: 'absolute',
              width: 'auto',
            }}
          />
        )}
        <div className="video-remote-name">
          {conversationName}
          <div data-uie-name="video-timer" className="video-timer label-xs">
            <Duration startedAt={startedAt} />
          </div>
        </div>
        {muteState === MuteState.REMOTE_MUTED && (
          <div
            className="video-title__info-bar"
            style={{
              position: 'absolute',
              right: '12px',
            }}
          >
            {t('muteStateRemoteMute')}
          </div>
        )}
      </div>

      <div id="video-element-remote" className="video-element-remote">
        <GroupVideoGrid
          maximizedParticipant={maximizedParticipant}
          selfParticipant={selfParticipant}
          grid={
            activeCallViewTab === CallViewTab.SPEAKERS
              ? {
                  grid: activeSpeakers,
                  thumbnail: null,
                }
              : videoGrid
          }
          setMaximizedParticipant={participant => setMaximizedParticipant(call, participant)}
        />
      </div>
      {!maximizedParticipant && activeCallViewTab === CallViewTab.ALL && totalPages > 1 && (
        <>
          {currentPage !== totalPages - 1 && (
            <button
              data-uie-name="pagination-next"
              onClick={() => changePage(currentPage + 1, call)}
              type="button"
              className="button-reset-default"
              css={{
                ...paginationButtonStyles,
                borderBottomLeftRadius: 32,
                borderTopLeftRadius: 32,
                right: 0,
              }}
            >
              <Icon.ArrowNext css={{left: 4, position: 'relative'}} />
            </button>
          )}
          {currentPage !== 0 && (
            <button
              data-uie-name="pagination-previous"
              type="button"
              onClick={() => changePage(currentPage - 1, call)}
              className="button-reset-default"
              css={{
                ...paginationButtonStyles,
                borderBottomRightRadius: 32,
                borderTopRightRadius: 32,
                left: 0,
              }}
            >
              <Icon.ArrowNext css={{position: 'relative', right: 4, transform: 'rotate(180deg)'}} />
            </button>
          )}
          <div css={{bottom: 108, display: 'flex', justifyContent: 'center', position: 'absolute', width: '100%'}}>
            <Pagination
              totalPages={totalPages}
              currentPage={currentPage}
              onChangePage={newPage => changePage(newPage, call)}
            />
          </div>
        </>
      )}
      {!isChoosingScreen && (
        <div id="video-controls" className="video-controls">
          <ul className="video-controls__wrapper">
            <li className="video-controls__item__minimize">
              <button
                className="video-controls__button"
                css={videoControlInActiveStyles}
                onClick={minimize}
                type="button"
                aria-labelledby="minimize-label"
                data-uie-name="do-call-controls-video-minimize"
              >
                {hasUnreadMessages ? (
                  <Icon.MessageUnread
                    css={{
                      marginRight: '-2px',
                      marginTop: '-2px',
                    }}
                  />
                ) : (
                  <Icon.Message />
                )}
                <span id="minimize-label" className="video-controls__button__label">
                  {t('videoCallOverlayConversations')}
                </span>
              </button>
            </li>
            <div className="video-controls__centered-items" css={{display: 'flex'}}>
              <li className="video-controls__item">
                <button
                  className="video-controls__button"
                  data-uie-value={!isMuted ? 'inactive' : 'active'}
                  onClick={() => toggleMute(call, !isMuted)}
                  css={!isMuted ? videoControlActiveStyles : videoControlInActiveStyles}
                  type="button"
                  aria-labelledby="mute-label"
                  data-uie-name="do-call-controls-video-call-mute"
                  role="switch"
                  aria-checked={!isMuted}
                >
                  <span id="mute-label" className="video-controls__button__label">
                    {t('videoCallOverlayMicrophone')}
                  </span>

                  {isMuted ? <Icon.MicOff width={16} height={16} /> : <Icon.MicOn width={16} height={16} />}
                </button>
              </li>

              {showToggleVideo && (
                <li className="video-controls__item">
                  <div
                    className="video-controls__button"
                    data-uie-value={selfSharesCamera ? 'active' : 'inactive'}
                    onClick={() => toggleCamera(call)}
                    onKeyDown={handleToggleCameraKeydown}
                    role="switch"
                    aria-checked={selfSharesCamera}
                    tabIndex={0}
                    css={selfSharesCamera ? videoControlActiveStyles : videoControlInActiveStyles}
                    aria-labelledby="video-label"
                    data-uie-name="do-call-controls-toggle-video"
                  >
                    {selfSharesCamera ? (
                      <Icon.Camera width={16} height={16} />
                    ) : (
                      <Icon.CameraOff width={16} height={16} />
                    )}

                    <span id="video-label" className="video-controls__button__label">
                      {t('videoCallOverlayCamera')}
                    </span>

                    {showSwitchCamera && (
                      <DeviceToggleButton
                        styles={css`
                          position: absolute;
                          bottom: -38px;
                          left: 50%;
                          transform: translateX(-50%);
                        `}
                        currentDevice={currentCameraDevice}
                        devices={availableCameras}
                        onChooseDevice={deviceId => switchCameraInput(call, deviceId)}
                      />
                    )}
                  </div>
                </li>
              )}

              <li className="video-controls__item">
                <button
                  className={`video-controls__button ${!canShareScreen ? 'with-tooltip with-tooltip--top' : ''}`}
                  data-tooltip={t('videoCallScreenShareNotSupported')}
                  css={
                    !canShareScreen
                      ? videoControlDisabledStyles
                      : selfSharesScreen
                      ? videoControlActiveStyles
                      : videoControlInActiveStyles
                  }
                  onClick={() => toggleScreenshare(call)}
                  type="button"
                  aria-labelledby="screnn-share-label"
                  data-uie-value={selfSharesScreen ? 'active' : 'inactive'}
                  data-uie-enabled={canShareScreen ? 'true' : 'false'}
                  data-uie-name="do-toggle-screen"
                >
                  {selfSharesScreen ? (
                    <Icon.Screenshare width={16} height={16} />
                  ) : (
                    <Icon.ScreenshareOff width={16} height={16} />
                  )}
                  <span id="screen-share-label" className="video-controls__button__label">
                    {t('videoCallOverlayShareScreen')}
                  </span>
                </button>
              </li>

              <li className="video-controls__item">
                <button
                  className="video-controls__button video-controls__button--red"
                  onClick={() => leave(call)}
                  type="button"
                  aria-labelledby="leave-label"
                  data-uie-name="do-call-controls-video-call-cancel"
                >
                  <Icon.Hangup />
                  <span id="leave-label" className="video-controls__button__label">
                    {t('videoCallOverlayHangUp')}
                  </span>
                </button>
              </li>
            </div>
            <div css={{display: 'flex', minWidth: '145px'}}>
              {participants.length > 2 && (
                <ButtonGroup
                  items={Object.values(CallViewTabs)}
                  onChangeItem={item => {
                    setActiveCallViewTab(item);
                    setMaximizedParticipant(call, null);
                  }}
                  currentItem={activeCallViewTab}
                  textSubstitute={participants.length.toString()}
                />
              )}
            </div>
          </ul>
        </div>
      )}
    </div>
  );
};

export default FullscreenVideoCall;
