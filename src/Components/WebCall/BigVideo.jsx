import React from 'react';
import Video from './Video';
import ProfileImage from '../../Components/WebChat/Common/ProfileImage'
import { CALL_STATUS_CONNECTED, CALL_STATUS_HOLD } from '../../Helpers/Call/Constant';
import { AudioOff, DropdownArrow, IconPinActive, VideoOff } from '../../assets/images';
import { initialNameHandle } from '../../Helpers/Chat/User';

class BigVideo extends React.Component {

    shouldComponentUpdate(nextProps, nextState) {
        if( this.props.showConfrenceDataId !== nextProps.showConfrenceDataId ||
            ((this.props.stream && nextProps.stream) && this.props.stream.id !== nextProps.stream.id) ||
            ((this.props.stream && nextProps.stream) && this.props.stream.video !== nextProps.stream.video) ||
            this.props.rosterData.image !== nextProps.rosterData.image ||
            nextProps.videoMuted !== this.props.videoMuted ||
            nextProps.audioMuted !== this.props.audioMuted ||
            nextProps.volumeLevel !== this.props.volumeLevel ||
            nextProps.showVoiceDetect !== this.props.showVoiceDetect ||
            nextProps.remoteStreamLength !== this.props.remoteStreamLength ||
            nextProps.callStatus !== this.props.callStatus ||
            nextProps.pinUserJid !== this.props.pinUserJid ||
            nextProps.setPinUser !== this.props.setPinUser ||
            nextProps.jid !== this.props.jid){
            return true;
        }
        return false;
    }
    
    handleAudioClasses = (volumeVdo = 0) => {
        let volume = volumeVdo === 'NaN' ? 0 : volumeVdo;
        if(volume > 5.5){    
            return "audio_vhigh";
        }
        else if(volume > 4.5){    
            return "audio_high";
        }
        else if(volume > 3.5){    
            return "audio_medium";
        }
        else if(volume > 1.5){    
            return "audio_normal";
        }
       else if(volume > .5){    
            return "audio_low";
        }
      else if(volume > 0){    
                return "audio_slient";
            }
     else {
        return "audio_hidden";
     }       
            
            
    }

    render() {
        let { audioMuted, videoMuted, rosterData, stream, remoteStreamLength, volumeLevel,volumeVideo, showVoiceDetect, inverse } = this.props;
        const token = localStorage.getItem('token');
        const iniTail = initialNameHandle(rosterData, rosterData.initialName);
        return (
            <>
                {!videoMuted && this.props.callStatus && (this.props.callStatus.toLowerCase() === CALL_STATUS_CONNECTED || this.props.callStatus.toLowerCase() === CALL_STATUS_HOLD) && stream && stream.video &&
                    <div className="VideoWrapper">
                        <div className="VideoWrapperInner">
                        <div className="participantCallStatus video">
                        {(this.props.setPinUser && this.props.jid === this.props.pinUserJid) &&
                            <i className="pinned"><IconPinActive /></i>
                            }
                        {!audioMuted && !remoteStreamLength <= 2 ?
                        <>
                            <div className={`audio_indication left height_adjust transistion_adjust ${this.handleAudioClasses(volumeVideo)}`}>
                                <div className="audio_indicator audio_indicator_1"></div>
                                <div className="audio_indicator audio_indicator_2"></div>
                                <div className="audio_indicator audio_indicator_3"></div>
                            </div>
                        </>
                        :
                        <i title="Participant is muted" className="AudioOffRemote"><AudioOff /></i>
                        }
                        </div>
                            <Video stream={stream.video} muted={false} id={stream.video.id} inverse={inverse}/>
                            {/* <Video stream={stream.video} muted={false} id={stream.video.id} inverse={inverse}/> */}
                        <div onClick={this.props.handleVideoFullView} className="VideofullView">
                            <i><DropdownArrow/> </i>
                        </div>
                        </div>
                        <span className="ParticipantInfo lg">{rosterData.displayName || rosterData.nickName}</span>
                    </div>
                }
                {(videoMuted || !stream || !stream.video || (this.props.callStatus && (this.props.callStatus.toLowerCase() !== CALL_STATUS_CONNECTED && this.props.callStatus.toLowerCase() !== CALL_STATUS_HOLD))) &&
                    <div className="avatar-wrapper">
                    <div className="participantCallStatus audio">
                        {videoMuted && <i title="Participant has stopped the camera" className="videoOffRemote"><VideoOff /></i>}
                        {audioMuted &&
                            <i title="Participant is muted" className="AudioOffRemote"><AudioOff /></i>
                        }
                        {(this.props.setPinUser && this.props.jid === this.props.pinUserJid) &&
                            <i className="pinned"><IconPinActive /></i>
                        }
                    </div>
                    <div className="avatar" id="dominantSpeakerAvatar">
                         <div className={"avatar-info " + (showVoiceDetect ? " v-detect" : "")}>
                             <span style={{ "transform": "scale(" + volumeLevel + ")"}} className="voice"></span>
                            <ProfileImage
                                name = {iniTail}
                                chatType='chat'
                                userToken={token}
                                temporary={false}
                                imageToken={rosterData.image}
                            />
                        </div>
                    </div>
                    <div onClick={this.props.handleVideoFullView} className="VideofullView">
                            <i><DropdownArrow/> </i>
                        </div>
                        <span className="ParticipantInfo lg">{rosterData.displayName || rosterData.nickName}</span>
                    </div>
                }
            </>
        )
    }
}

export default BigVideo;
