import React, { Component, Fragment } from "react";
import { connect } from "react-redux";
import uuidv4 from "uuid/v4";
import {
  messageForwardReset,
  MessageAction,
  messageInfoAction,
  ReplyMessageAction,
  selectedMessageInfo
} from "../../../Actions/MessageActions";
import { get as _get } from "lodash";
import { loaderSVG, BlockedIcon } from "../../../assets/images";
import SDK from "../../SDK";
import Modal from "../Common/Modal";
import MessageInfo from "../MessageInfo";
import BroadCastTemplate from "./Templates/BroadCastTemplate";
import ForwardOptions from "./Templates/Common/ForwardOptions";
import ChatTemplate from "./Templates/ChatTemplate";
import WebChatMessagesComposing from "./WebChatMessagesComposing";
import {
  getActiveConversationUserJid,
  isSingleChat,
  isBroadcastChat,
  getActiveConversationMessageByMsgId,
  getReplyMessageFormat,
  getActiveConversationChatId,
  isSingleOrGroupChat,
  getChatMessageHistoryById,
  getActiveChatMessages,
  downloadMediaFile,
  isTextMessage,
  handleTempArchivedChats,
  isGroupChat,
  getMessagesForReport
} from "../../../Helpers/Chat/ChatHelper";
import {
  getMessageObjSender,
  getMessageType,
  getRecentChatMsgObj,
  blockOfflineAction,
  isAppOnline,
  getTranslateTargetLanguage
} from "../../../Helpers/Utility";
import { RecentChatUpdateAction } from "../../../Actions/RecentChatActions";
import Store from "../../../Store";
import {
  getSenderIdFromMsgObj,
  formatUserIdToJid,
  formatGroupIdToJid,
  getIdFromJid,
  getContactNameFromRoster,
  getDataFromRoster
} from "../../../Helpers/Chat/User";
import { scrollBottomChatHistoryAction } from "../../../Actions/ScrollAction";
import { updateMsgSeenStatus } from "../Common/createMessage";
import { ChatMessageHistoryDataAction, TranslateMessageHistory } from "../../../Actions/ChatHistory";
import { CHAT_HISTORY_LIMIT, FEATURE_RESTRICTION_ERROR_MESSAGE, RECONNECT_GET_CHAT_LIMIT } from "../../../Helpers/Constants";
import { CHAT_TYPE_GROUP, CHAT_TYPE_SINGLE, UNBLOCK_CONTACT_TYPE } from "../../../Helpers/Chat/Constant";
import { BlockPopUp } from "../PopUp/BlockPopUp";
import { updateBlockedContactAction } from "../../../Actions/BlockAction";
import { toast } from "react-toastify";
import { handleMessageParseHtml } from "../../../Helpers/Chat/RecentChat";
import { REACT_APP_GOOGLE_TRANSLATE_API_KEY } from "../../processENV";
import ActionInfoPopup from "../../ActionInfoPopup";
import { showModal } from "../../../Actions/PopUp";

class WebChatConversationHistory extends Component {
  constructor(props) {
    super(props);
    this.state = {
      messageData: "",
      loaderStatus: true,
      loadMoreStatus: false,
      prevMsgStatus: "",
      sendMessgeType: "",
      replyMessage: {},
      dragOnContainer: {},
      showModal: false,
      forwardOption: false,
      messageInfo: {},
      isBlocked: false,
      addionalnfo: {},
      isVisibleScroll: false,
      showBlockModal: false,
      blockId: null,
      nameToDisplay: "",
      showReportPopup: false,
      reportData: {},
      userReplayDetails: [],
      msgActionType: "",
      isAdminBlocked: false,
      isDeletedAccount:false,
      originalMessageDeleted: false,
    };
    this.activeTimer = 0;
    this.rosterConst = "roster.userId";
    this.rosterGrpIdConst = "roster.groupId";
    this.loadMore = React.createRef();
  }

  reportChatAction = (show = false) => {
    this.setState({
      showReportPopup: show
    });
  }

  reportConfirmAction = async(event) => {
    if(event.detail <= 1){
      if (blockOfflineAction()) return;
      const { activeChatId = "", activeChatData:{ data : { chatJid = "",chatType="" } } } = this.props;
      const { msgId = "" } = this.state.reportData || {};
      const reportData = getMessagesForReport(activeChatId, msgId)
      if(reportData.length === 0){
        toast.error(`No Messages To Report`)
        this.reportChatAction(false);
      }else{
        await SDK.reportUserOrGroup(chatJid,chatType,reportData)
        toast.success(`Report sent`);
        this.reportChatAction(false);
    }
    }
  }

  componentDidMount() {
    const chatType = this.props?.activeChatData?.data?.chatType;
    this.handleBlockUserData();
    this.requestChatMessages(chatType);
  }

  componentDidUpdate(prevProps, prevState) {
    const { activeChatId } = this.props;
    
    if(prevProps.rosterData.id !== this.props.rosterData.id){
        const { data = [] } = this.props.rosterData
        let selectedUser = data.find(ele=> ele.userId === activeChatId)
        
        if( selectedUser?.isDeletedUser || selectedUser?.isAdminBlocked ){
            if(this.state.showReportPopup){
              toast.error(selectedUser?.isDeletedUser ? `Cannot report deleted user's message` : `This user no longer available`)
            }
            this.setState({
              showReportPopup: false,
              isAdminBlocked: selectedUser?.isAdminBlocked,
              isDeletedAccount: selectedUser?.isDeletedUser
            })
        }
        this.setState({
          isAdminBlocked: selectedUser?.isAdminBlocked,
          isDeletedAccount: selectedUser?.isDeletedUser
        })

    }

    if (prevProps.activeChatId !== activeChatId) {
      this.handleBlockUserData();
      setTimeout(() => {
        this.scrollToBottom();
      }, 60); 
    }

    if (
      prevProps.browserTabData.isVisible !== this.props.browserTabData.isVisible &&
      this.props.browserTabData.isVisible
    ) {
      updateMsgSeenStatus();
    }

    if (
      prevProps.blockedContact &&
      this.props.blockedContact &&
      prevProps.blockedContact.id !== this.props.blockedContact.id
    ) {
      this.handleBlockUserData();
      return;
    }

    const { chatId, chatType } = this.props?.activeChatData?.data;

    if (prevProps.chatConversationHistory.id !== this.props.chatConversationHistory.id) {
      this.setState({ loaderStatus: false, jid: chatId });
    }

    if (prevProps.activeChatData.id !== this.props.activeChatData.id) {
      const conversationHistory = this.props.chatConversationHistory.data;
      this.loadMoreUpdate(false);
      this.props.forwardReset();
      this.props.scrollBottomChatHistoryAction();
      this.props.messageInfoShow(false);
      if (!Object.keys(conversationHistory).includes(chatId)) {
        this.setState({ jid: chatId, loaderStatus: true, forwardOption: false });
        this.requestChatMessages(chatType);
      } else {
        updateMsgSeenStatus();
        this.setState({ jid: chatId, loaderStatus: false, forwardOption: false });
      }
    }

    if (prevProps.scheduleMeetData !== this.props.scheduleMeetData){
      this.handleSendMeetMsg(this.props.scheduleMeetData)
    }

  }

  requestChatMessages = async (
    chatType,
    direction = null,
    messageId = null,
    limit = CHAT_HISTORY_LIMIT,
    rowId = null
  ) => {
    const activeChatMessages = getActiveChatMessages();
    const activeChatFirstMessage = activeChatMessages && activeChatMessages[0];
    const activeChatLastMessage = activeChatMessages && activeChatMessages[activeChatMessages.length - 1];
    let lastactiveChatId = null;
    if (!Array.isArray(activeChatMessages)) {
        return null;
    } else {
        for (let i = activeChatMessages.length - 1; i >= 0; i--) {
            const currentMessage = activeChatMessages[i];
            if (currentMessage && currentMessage.msgId === activeChatLastMessage?.msgId) {
                lastactiveChatId = currentMessage.msgId;
                break;
            }
        }
    }
    if (isSingleOrGroupChat(chatType)) {
      let chatJid = getActiveConversationUserJid(),
        activeConversationId = getActiveConversationChatId();
      if (!chatJid) return true;
      
      const chatMessageRes = await SDK.getChatMessages(chatJid, direction, rowId, limit);
      // User may switch another user chat conversation screen when clicked user chat request is in process
      // That's why we check condition(compare userJid from response) here to avoid load the previous user chat history to current users.
      if (chatMessageRes && chatMessageRes.statusCode === 200) {
        const chatLastMessage = chatMessageRes?.data[chatMessageRes?.data?.length - 1];
        if((activeChatFirstMessage && activeChatFirstMessage?.msgId === chatLastMessage?.msgId) || (lastactiveChatId && lastactiveChatId === activeChatLastMessage?.msgId) ){
          this.setState({originalMessageDeleted: true})
        }

        chatMessageRes.chatType = chatType;
        chatMessageRes.fetchLimit = limit;
        delete chatMessageRes.statusCode;
        delete chatMessageRes.message;
        if (activeConversationId === getIdFromJid(chatMessageRes.userJid || chatMessageRes.groupJid)) {
          Store.dispatch(ChatMessageHistoryDataAction(chatMessageRes));
        }
      }
      return true;
    }
    return false;
    // Pending - Add for Broadcast
  };

  requestReplyMessage = (grmsgid, replyTo, chatType) => {
    if (isAppOnline()) {
      SDK.getReplyMessage(replyTo, chatType);
    } else {
      // When user try to reply in offline, at this time get the message
      // details from the local message history & set that message as reply message
      const message = getActiveConversationMessageByMsgId(replyTo, chatType);
      const replyMsgDetails = getReplyMessageFormat(message);
      if (replyMsgDetails) {
        Store.dispatch(ReplyMessageAction(replyMsgDetails));
      }
    }
  };

  onScrolledTop = async () => {
    const {
      activeChatData: { data: { chatType, chatId } = {} } = {},
      chatConversationHistory: { data }
    } = this.props;

    if (data[chatId]) {
      const { messages: currentChatHistory, isScrollNeeded } = data[chatId];
      if (isScrollNeeded) {
        this.loadMoreUpdate(true);
        const firstMessageId = Object.keys(currentChatHistory)[0];
        const firstMessageData = currentChatHistory[firstMessageId];
        await this.requestChatMessages(chatType, "up", firstMessageId, CHAT_HISTORY_LIMIT, firstMessageData?.rowId);
        this.loadMoreUpdate(false);
      }
    }
  };

  onScrolled = (event) => {
    const { target } = event;
    if (target.offsetHeight + target.scrollTop >= target.scrollHeight - 20) {
      this.setState({
        isVisibleScroll: false
      });
    } else {
      this.setState({
        isVisibleScroll: true
      });
    }
  };
  onScrolledBottom = () => { };

  componentWillUnmount() {
    clearTimeout(this.activeTimer);
  }

  smoothScroll = (elementId) => {
    const container = document.getElementById(elementId);
    if (!container) return;
    container.scrollIntoView();
    container.classList.add("animatefinded");
    this.activeTimer = setTimeout(() => {
      container.classList.remove("animatefinded");
    }, 500);
  };

  // Show button when page is scorlled upto given distance
  // Set the top cordinate to 0
  // make scrolling smooth
  scrollToBottom = () => {
    document && document.getElementById("InBottom")?.scrollIntoView({ block: "end" });
  };

  viewOriginalMessage = async (messageId, msgId) => {
    const chatType = this.props?.activeChatData?.data?.recent?.chatType;

    const chatMessages = getActiveChatMessages();
    const isExist = chatMessages.find((message) => message.msgId === messageId);
    if (isExist) {
      this.smoothScroll(messageId);
      return;
    }
    if (chatMessages.length && !this.state.originalMessageDeleted) { 
     this.loadMoreUpdate(true);
     await this.requestChatMessages(chatType, "up", chatMessages[0].msgId, RECONNECT_GET_CHAT_LIMIT);
      setTimeout(() => {
        this.loadMoreUpdate(false);
        this.viewOriginalMessage(messageId, msgId);
      }, 100);
    }else {
      this.setState({originalMessageDeleted:false})
    }
  };

  prepareJid = () => {
    let data =
      Object.keys(this.props.activeChatData.data.roster).length > 0
        ? this.props.activeChatData.data.roster
        : this.props.activeChatData.data.recent;

    const chatType = this.props?.activeChatData?.data?.recent?.chatType;
    if (chatType === "chat" || chatType === "broadcast") {
      const jid = data.userId ? data.userId : data.fromUserId;
      return formatUserIdToJid(jid);
    }
    const groupId = data.groupId;
    return formatGroupIdToJid(groupId);
  };

  deleteMessageFromConversation = (deleteType) => (event) => {
    if (blockOfflineAction()) return;
    const {
      selectedMessageData: { data }
    } = this.props;
    let msgIds = data.sort((a, b) => (b.timestamp > a.timestamp ? -1 : 1)).map((el) => el.msgId);

    const jid = this.prepareJid();
    this.setState(
      {
        showModal: false,
        replyMessage: {}
      },
      async () => {
        this.props.forwardReset();
        if (deleteType === 1) {
          await SDK.deleteMessagesForMe(jid, msgIds);
        } else {
          await SDK.deleteMessagesForEveryone(jid, msgIds);
        }
        toast.success(`${msgIds.length} message${msgIds.length > 1 ? "s" : ""} deleted`);
      }
    );
    this.setState({
      forwardOption: false
    });
  };

  deleteMultipleMessages = () => {
    if (blockOfflineAction()) return;
    const {
      selectedMessageData: { data }
    } = this.props;

    let msgIds = data.sort((a, b) => (b.timestamp > a.timestamp ? -1 : 1)).map((el) => el.msgId);
    let lastMsgIndex = data.findIndex((obj) => obj.msgId === msgIds[0]);
    let lastMsgTime = parseInt(data[lastMsgIndex].timestamp / 1000);
    const now = new Date().getTime();
    const validTime = lastMsgTime + 30 * 1000;

    this.setState((prevState) => ({
      showModal: true,
      replyMessage: {
        ...prevState.replyMessage,
        deleteEveryOne: validTime > now
      }
    }));
  };

  handleShowMessageinfo = () => {
    this.setState({
      messageInfo: {}
    });
    this.props.messageInfoShow(!this.props.showMessageinfo);
  };

  handleStarredAction = async () => {
    if (blockOfflineAction()) return;
    const {
      selectedMessageData: { data }
    } = this.props;

    let isFavourite = false;
    const msgIds = data.map((el) => {
      if (el.favouriteStatus === 0) {
        isFavourite = true;
      }
      return el.msgId;
    });
    await SDK.updateFavouriteStatus(this.props.activeChatData.data.chatJid, msgIds, isFavourite);
    toast.success(`${data.length} message${data.length > 1 ? "s" : ""} ${isFavourite ? "starred" : "unstarred"}`);
    this.setState({ forwardOption: false });
    this.props.forwardReset();
  };

  messageAction = async (event, selectedMessage, nameToDisplay) => {
    const targetElement = event.target || event.srcElement;
    const { deleteStatus, msgId } = selectedMessage;
    const senderId = getSenderIdFromMsgObj(selectedMessage);

    if (targetElement.tagName === "UL") return;
    const optionType = targetElement.closest("li").getAttribute("title");
    const { fromUser } = this.props.vCardData?.data;
    const isSender = senderId && senderId.indexOf(fromUser) !== -1;

    if (optionType === "Reply") {
      const {
        activeChatData: { data = {} }
      } = this.props;
      const { userReplayDetails = [] } = this.state;
      const reMovedata = [...userReplayDetails];
      const reMoveEle = (reMovedata || []).filter(
        (ele) =>
          _get(ele, this.rosterConst, null) !== _get(data, this.rosterConst, undefined) &&
          _get(ele, this.rosterGrpIdConst, null) !== _get(data, this.rosterGrpIdConst, undefined)
      );
      const newObjData = {
        replyMessages: {
          ...selectedMessage
        }
      };
      const newObj = { ...newObjData, ...data };
      const newArr = [...reMoveEle, newObj];
      this.setState({ userReplayDetails: newArr });
    }

    if (optionType === "Delete") {
      if (blockOfflineAction()) return;
      const { addionalnfo } = this.state;
      this.props.messageInfoShow(false);
      this.setState({
        msgActionType: "Delete",
        forwardOption: true,
        addionalnfo: {
          ...addionalnfo,
          forward: true,
          forwardMessageId: msgId,
          deleteAction: true
        },
        replyMessage: {
          ...selectedMessage,
          isSender: isSender,
          messageInfo: {},
          recallstatus: deleteStatus
        }
      });
      return;
    }

    if (optionType === "MessageInfo") {
      if (blockOfflineAction()) return;
      this.props.messageInfoShow(true);
      this.setState(
        {
          forwardOption: false,
          messageInfo: {
            ...selectedMessage,
            isSender: isSender,
            forward: false
          }
        },
        () => {
          let jid = this.prepareJid();
          const { msgId: messageId } = this.state.messageInfo;
          Store.dispatch(messageInfoAction({ statusUpdate: false, messageId }, true));
          messageId && SDK.getGroupMsgInfo(jid, messageId);
          Store.dispatch(selectedMessageInfo(selectedMessage))

        }
      );
      return;
    }

    if (optionType === "Forward") {
      const { addionalnfo } = this.state;
      this.props.messageInfoShow(false);
      this.setState({
        msgActionType: "Forward",
        forwardOption: true,
        addionalnfo: {
          ...addionalnfo,
          forward: true,
          forwardMessageId: msgId,
          deleteAction: false
        }
      });
      return;
    }

    if (optionType === "Report") {
      if(this.state.isDeletedUser || this.state.isAdminBlocked){
        toast.error(this.state.isDeletedUser ? `Cannot report deleted user's message` : `This user no longer available`)
        return
      }    
      if(getDataFromRoster(this.props?.activeChatId)?.isDeletedUser || getDataFromRoster(this.props?.activeChatId)?.isAdminBlocked){
        toast.error(getDataFromRoster(this.props?.activeChatId)?.isDeletedUser ? `Cannot report deleted user's message` : `This user no longer available`)
        return
      }
      this.setState({ reportData: selectedMessage });
      this.reportChatAction(true)
      return;
    }

    if (optionType === "Starred" || optionType === "UnStarred") {
      if (blockOfflineAction()) return;
      const { addionalnfo } = this.state;
      this.props.messageInfoShow(false);
      this.setState({
        msgActionType: optionType,
        forwardOption: true,
        addionalnfo: {
          ...addionalnfo,
          forward: true,
          forwardMessageId: msgId,
          deleteAction: false
        },
        replyMessage: {
          ...selectedMessage,
          isSender: isSender,
          messageInfo: {},
          recallstatus: deleteStatus
        }
      });
      return;
    }

    if (optionType === "Download") {
      const { msgBody: { media: { file_url, fileName: file_name, file_key } = {}, message_type = "" } = {} } = selectedMessage;
      const fileName = message_type === "file" ? file_name : "";
      downloadMediaFile(msgId , file_url, message_type, fileName, file_key);
      return;
    }
    this.setState({
      sendMessgeType: optionType,
      replyMessage: {
        ...selectedMessage,
        nameToDisplay: nameToDisplay || ""
      }
    });
  };

  handleTranslateLanguage = async (msgId, replyMessage) => {
    if (blockOfflineAction()) return;
    const { msgBody: { message = "", message_type = "", media: { caption = "" } = {} } = {} } = replyMessage;
    const text = isTextMessage(message_type) ? message : caption;
    if (text) {
      const target = getTranslateTargetLanguage();
      const translateResult = await SDK.translateText(REACT_APP_GOOGLE_TRANSLATE_API_KEY, text, target);
      if (translateResult.statusCode === 200 && translateResult.data?.translations.length > 0) {
        const dispatchData = {
          fromUserId: this.props.activeChatId,
          msgId: msgId,
          translatedMessage: translateResult.data?.translations[0].translatedText || ""
        };
        Store.dispatch(TranslateMessageHistory(dispatchData));
      }
    }
  }

  closeReplyAction = (userId = "") => {
    const { userReplayDetails = [] } = this.state;
    const replyData = [...userReplayDetails];
    const reMoveEle = replyData.filter(
      (ele) => _get(ele, this.rosterConst, null) !== userId && _get(ele, this.rosterGrpIdConst, null) !== userId
    );
    this.setState({
      sendMessgeType: reMoveEle.length !== 0 ? "Reply" : "",
      replyMessage: {},
      showModal: false,
      userReplayDetails: reMoveEle
    });
  };

  replyToIdPass = (jid = "") => {
    const { userReplayDetails = [] } = this.state;
    if (userReplayDetails.length !== 0) {
      const replyData = [...userReplayDetails];
      const findUserMsgId = replyData.find(
        (ele) => _get(ele, this.rosterConst, "") === jid || _get(ele, this.rosterGrpIdConst, "") === jid
      );
      return _get(findUserMsgId, "replyMessages.msgId", "");
    }
    return "";
  };

  sendMediaMessage = async (messageType, files, chatType) => {
    let jid = this.prepareJid();
    const jids = getIdFromJid(jid);
    const { sendMessgeType } = this.state;
    sendMessgeType && this.closeReplyAction(jids);
    if (messageType === "media") {
      let mediaData = {};

      // For Local Render Process - Needs to be Handled with "Asynchronous"
      for (let i = 0; i < files.length; i++) {
        const file = files[i],
          msgId = uuidv4();
        const { caption = "",mentionedUsersIds =[], fileDetails: { replyTo, duration = 0, imageUrl = "", audioType = "" } = {} } = file;
        let fileOptions = {
          fileName: file.name,
          fileSize: file.size,
          caption: caption,
          blobUrl: imageUrl,
          msgId: msgId,
          duration: duration,
          audioType
        };

        const msgType = getMessageType(file.type, file);
        if (msgType === "video" || msgType === "audio") fileOptions.thumbImage = imageUrl;
        const userProfile = this.props?.vCardData;

        const dataObj = {
          jid,
          msgType,
          userProfile,
          chatType,
          msgId,
          file,
          fileOptions,
          replyTo,
          fileDetails: file.fileDetails,
          mentionedUsersIds: mentionedUsersIds
        };

        const conversationChatObj = await getMessageObjSender(dataObj, i);
        mediaData[msgId] = conversationChatObj;
        const recentChatObj = getRecentChatMsgObj(dataObj);

        const dispatchData = {
          data: [conversationChatObj],
          ...(isSingleChat(chatType) ? { userJid: jid } : { groupJid: jid })
        };
        Store.dispatch(ChatMessageHistoryDataAction(dispatchData));
        Store.dispatch(MessageAction(conversationChatObj));
        Store.dispatch(RecentChatUpdateAction(recentChatObj));
      }
      handleTempArchivedChats(jid, chatType);
      this.props.scrollBottomChatHistoryAction();
    }
    return false;
  };

  parseAndSendMessage = async (message, chatType, messageType) => {
    const jid = this.prepareJid();
    const jids = getIdFromJid(jid);
    const { content } = message;
    const { sendMessgeType = "" } = this.state;
    const replyTo = sendMessgeType ? this.replyToIdPass(jids) : "";
    content[0].fileDetails.replyTo = replyTo;
    this.sendMediaMessage(messageType, content, chatType);
  };

  msgReplyPassId = (replyMessage = {}) => {
    let jid = this.prepareJid();
    const jids = getIdFromJid(jid);
    const { sendMessgeType = "", userReplayDetails = [] } = this.state;
    if (sendMessgeType === "Reply") {
      const findUserMsgId = userReplayDetails.find(
        (ele) => _get(ele, this.rosterConst, "") === jids || _get(ele, this.rosterGrpIdConst, "") === jids
      );
      return _get(findUserMsgId, "replyMessages.msgId", "");
    }
    return sendMessgeType ? replyMessage.msgId : "";
  };

  handleSendMsg = async (message) => {
    let messageType = message.type;
    let chatType = this.props?.activeChatData?.data?.recent?.chatType;
    if (messageType === "media") {
      this.parseAndSendMessage(message, chatType, messageType);
      return;
    }
    const { sendMessgeType = "", replyMessage = {} } = this.state;
    const replyTo = this.msgReplyPassId(replyMessage);
    const userProfile = this.props?.vCardData;
    const msgId = uuidv4();
    if (message.content !== "") {
      let jid = this.prepareJid();
      const jids = getIdFromJid(jid);
      await SDK.sendTextMessage({
        toJid: jid,
        messageText: handleMessageParseHtml(message.content),
        msgId: msgId,
        replyMessageId: replyTo,
        mentionedUsersIds: message?.mentionedUsersIds
      });
      if (chatType === CHAT_TYPE_SINGLE || chatType === CHAT_TYPE_GROUP) {      
        const dataObj = {
          jid,
          msgType: "text",
          message: handleMessageParseHtml(message.content),
          userProfile,
          chatType,
          msgId,
          replyTo,
          mentionedUsersIds: message?.mentionedUsersIds
        };
        const conversationChatObj = await getMessageObjSender(dataObj);
        const recentChatObj = getRecentChatMsgObj(dataObj);
        SDK.sendTypingGoneStatus(jid);
        Store.dispatch(MessageAction(conversationChatObj));
        const dispatchData = {
          data: [conversationChatObj],
          ...(isSingleChat(chatType) ? { userJid: jid } : { groupJid: jid })
        };
        Store.dispatch(ChatMessageHistoryDataAction(dispatchData));
        Store.dispatch(RecentChatUpdateAction(recentChatObj));
        handleTempArchivedChats(jid, chatType);
        this.props.scrollBottomChatHistoryAction();
        sendMessgeType && this.closeReplyAction(jids);
      } else if (chatType === "broadcast") {
        const broadcastId = this.props?.activeChatData?.data?.recent?.broadcastId;
        let broadcastJid = formatUserIdToJid(broadcastId);
        SDK.sendBroadcastMessage(
          handleMessageParseHtml(message.content),
          "text",
          msgId,
          "",
          "",
          broadcastJid,
          replyTo
        ).then((res) => {
          if (res.statusCode === 200) {
            this.props.scrollBottomChatHistoryAction();
            sendMessgeType && this.closeReplyAction(jids);
          }
        });
      }
    }
  }
  ;

  handleSendMeetMsg = async (scheduleMeetData) => {
    if (this.canSendMessage() && !this.state.isAdminBlocked) {
      let chatType = this.props?.activeChatData?.data?.recent?.chatType;
      const msgId = uuidv4();
      const { sendMessgeType = "", replyMessage = {} } = this.state;
      const replyTo = this.msgReplyPassId(replyMessage);
      const jid = this.prepareJid();
      const jids = getIdFromJid(jid);
      const scheduleMeetLink = scheduleMeetData.scheduleMeetLink;
      const userProfile = this.props?.vCardData;
      await SDK.sendMeetMessage({
        toJid: jid,
        link: handleMessageParseHtml(scheduleMeetLink),
        title: "schedule meet",
        msgId: msgId,
        replyMessageId: replyTo,
        mentionedUsersIds: [],
        scheduledDateTime: scheduleMeetData.scheduledDateTime
      })
        const dataObj = {
          jid,
          msgType: "meet",
          message: handleMessageParseHtml(scheduleMeetLink),
          userProfile,
          chatType: chatType,
          msgId,
          replyTo,
          meet:{
            link:scheduleMeetLink,
            scheduledDateTime: scheduleMeetData.scheduledDateTime ? scheduleMeetData.scheduledDateTime : 0,
            title: "schedule meet",
          },
          mentionedUsersIds: []
        };
        const conversationChatObj = await getMessageObjSender(dataObj);
        const recentChatObj = getRecentChatMsgObj(dataObj);
        SDK.sendTypingGoneStatus(jid);
        Store.dispatch(MessageAction(conversationChatObj));
        const dispatchData = {
          data: [conversationChatObj],
          ...(isSingleChat(chatType) ? { userJid: jid } : { groupJid: jid })
        };
        Store.dispatch(ChatMessageHistoryDataAction(dispatchData));
        Store.dispatch(RecentChatUpdateAction(recentChatObj));
        handleTempArchivedChats(jid, chatType);
        this.props.scrollBottomChatHistoryAction();
        sendMessgeType && this.closeReplyAction(jids);
    }
    else {
      Store.dispatch(
        showModal({
            open: false,
            modelType: "scheduleMeeting"
        })
    );
    }
  }

  closeMessageOption = (forward = null) => {
    const { addionalnfo } = this.state;
    this.setState(
      {
        forwardOption: false,
        addionalnfo: {
          ...addionalnfo,
          forward: false
        }
      },
      () => {
        this.props.forwardReset();
      }
    );
  };

  canSendMessage = () => {
    const { isBlocked } = this.state;
    const chatType = this.props?.activeChatData?.data?.recent?.chatType;
    if (chatType === "broadcast") {
      return true;
    }
    if (chatType === "chat") {
      return !isBlocked;
    }
    const fromUser = this.props?.vCardData?.data?.fromUser;
    const { groupsMemberListData: { data: { participants = [] } = {} } = {} } = this.props;
    return participants.find((profile) => {
      return fromUser === profile.userId && profile.userType;
    });
  };

  onDragEnter = (event) => {
    if (event.dataTransfer.types) {
      for (const type of event.dataTransfer.types) {
        if (type === "Files") {
          const dragId = document.getElementById("msgContent");
          dragId.setAttribute("draggable", true);
          this.setState(
            {
              dragOnContainer: {
                status: true,
                draggedId: uuidv4()
              }
            },
            () => {
              dragId.setAttribute("draggable", false);
            }
          );
        }
      }
    }
    return false;
  };

  handleBlockUserData = () => {
    const { activeChatData: { data: { roster, recent } = [] } = {} } = this.props;
    const detail = roster && Object.keys(roster).length > 0 ? roster : recent;
    const jid = formatUserIdToJid(detail.userId);
    if (!jid) return false;
    let blockedContactArr = this.props.blockedContact.data;
    const isBlocked = blockedContactArr.indexOf(jid) > -1;
    this.setState({ isBlocked });
    return true;
  };

  dispatchAction = async () => {
    this.setState({
      showBlockModal: false
    });
    const {featureStateData: {isBlockEnabled = false} = {} } = this.props;
    if(isBlockEnabled) {
      const userJid = formatUserIdToJid(this.state.blockId);
      const res = await SDK.unblockUser(userJid);
      if (res && res.statusCode === 200) {
        Store.dispatch(updateBlockedContactAction(this.state.blockId, UNBLOCK_CONTACT_TYPE));
        toast.success(`${this.state.nameToDisplay || "User"} has been Unblocked`);
        handleTempArchivedChats(userJid, CHAT_TYPE_SINGLE);
      }
    } else {
      toast.error(FEATURE_RESTRICTION_ERROR_MESSAGE);
    }
    
  };

  popUpToggleAction = (userJid, nameToDisplay) => {
    const { activeChatData: { data: { roster } = [] }, featureStateData: {isBlockEnabled = false} = {} } = this.props;
    if(isBlockEnabled) {
      this.setState({
        showBlockModal: !this.state.showBlockModal,
        blockId: userJid ? userJid : null,
        nameToDisplay: getContactNameFromRoster(roster)
      });
    } else {
      toast.error(FEATURE_RESTRICTION_ERROR_MESSAGE);
    }
  };

  loadMoreUpdate = (value) => {
    this.loadMore.current.style.display = value ? "block" : "none";
    return true;
  };

  render() {
    const style = { width: 50, height: 50 };
    const loadMoreStyle = { width: 50, height: 50, display: "none" };
    const {
      sendMessgeType,
      replyMessage,
      showModal,
      loaderStatus,
      jid,
      dragOnContainer,
      mediaLoder,
      messageInfo,
      addionalnfo,
      forwardOption,
      showBlockModal,
      nameToDisplay,
      showReportPopup = false,
      selectedMsgUserName = "",
  
    } = this.state;

    const { groupMemberDetails, selectedMessageData, showMessageinfo = false } = this.props;
    const chatType = this.props.activeChatData?.data?.recent?.chatType;
    const lastServerMessage = this.props?.messageData;
    const groupNickName = this.props?.activeChatData?.data?.roster?.nickName;
    const { deleteStatus, deleteEveryOne = null, isSender = null } = replyMessage || {};
    const chatMessages = jid && !loaderStatus ? getChatMessageHistoryById(jid) : [];
    let { isAdminBlocked = false } = getDataFromRoster(jid) || {};
    isAdminBlocked = isAdminBlocked === 0 || !isAdminBlocked ? false : true;
    return (
      <Fragment>
        {showBlockModal && (
          <Modal containerId="container">
            <BlockPopUp
              popUpToggleAction={this.popUpToggleAction}
              dispatchAction={this.dispatchAction}
              headerLabel={
                <>
                  {"Unblock"} {nameToDisplay} ?
                </>
              }
              closeLabel={"Cancel"}
              actionLabel={"Unblock"}
              infoLabel={"On unblocking, this contact will be able to call you or send messages to you."}
            />
          </Modal>
        )}
        <div className={`chatconversation-container`}>
          <div onDragEnter={this.onDragEnter} id="msgContent" className="msg-content">
            <div className="loader">
              {loaderStatus && <img src={loaderSVG} alt="message-history" style={style} />}
              <img src={loaderSVG} alt="load-history" ref={this.loadMore} style={loadMoreStyle} />
            </div>
            {isSingleOrGroupChat(chatType) && !loaderStatus && (
              <ChatTemplate
                chatmessages={chatMessages}
                rosterData={this.props.rosterData}
                groupMemberDetails={groupMemberDetails}
                vCardData={this.props.vCardData}
                onScrolledTop={this.onScrolledTop}
                onScrolledBottom={this.onScrolledBottom}
                closeMessageOption={this.closeMessageOption}
                messageAction={this.messageAction}
                requestReplyMessage={this.requestReplyMessage}
                viewOriginalMessage={this.viewOriginalMessage}
                groupNickName={groupNickName}
                jid={jid}
                addionalnfo={addionalnfo}
                deliveredType={lastServerMessage}
                chatType={chatType}
                onScrolled={this.onScrolled}
                scrollToBottom={this.scrollToBottom}
                handleTranslateLanguage={this.handleTranslateLanguage}
                handleShowCallScreen={this.props.handleShowCallScreen}
              />
            )}

            {isBroadcastChat(chatType) && !loaderStatus && (
              <BroadCastTemplate
                chatmessages={chatMessages}
                requestReplyMessage={this.requestReplyMessage}
                vCardData={this.props.vCardData}
                onScrolledTop={this.onScrolledTop}
                messageAction={this.messageAction}
                closeMessageOption={this.closeMessageOption}
                onScrolledBottom={this.onScrolledBottom}
                viewOriginalMessage={this.viewOriginalMessage}
                jid={jid}
                addionalnfo={addionalnfo}
                deliveredType={lastServerMessage}
                chatType={chatType}
                onScrolled={this.onScrolled}
              />
            )}
          </div>

          {this.state.isBlocked && isSingleChat(chatType) && !isAdminBlocked
            && (
              <div className="blockedContainer">
                <p>
                  <i>
                    <BlockedIcon />
                  </i>{" "}
                  <span>
                    {`You can't send message to this blocked contact.`}
                    <span
                      className="link"
                      onClick={() => {
                        this.popUpToggleAction(jid, nameToDisplay);
                      }}
                    >
                      Unblock
                    </span>
                  </span>
                </p>
              </div>
            )}
          {(isSingleChat(chatType) && isAdminBlocked) &&
            <div className="blockedUserContainer">
              <p>This user is no longer available</p>
            </div>
          }
          {forwardOption && (
            <ForwardOptions
              msgActionType={this.state.msgActionType}
              activeJid={jid}
              closeMessageOption={this.closeMessageOption}
              deleteMultipleMessages={this.deleteMultipleMessages}
              handleStarredAction={this.handleStarredAction}
            />
          )}
          {showModal && (
            <Modal containerId="container">
              <div className="popup-wrapper deleteMessage">
                <div className="popup-container">
                  <div className="popup-container-inner">
                    <div className="popup-label">
                      <label>
                        Are you sure you want to delete selected message
                        {selectedMessageData?.data?.length > 1 ? "s" : ""}?
                      </label>
                    </div>
                    <div className="popup-noteinfo">
                      {deleteStatus === 0 && isSender && deleteEveryOne ? (
                        <Fragment>
                          <button
                            type="button"
                            onClick={this.deleteMessageFromConversation(1)}
                            className="btn-cancel danger"
                          >
                            Delete For Me
                          </button>
                          <button
                            type="button"
                            onClick={() => this.setState({ showModal: false })}
                            className="btn-cancel"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={this.deleteMessageFromConversation(2)}
                            className="btn-active danger"
                          >
                            Delete For Everyone
                          </button>
                        </Fragment>
                      ) : (
                        <Fragment>
                          <button
                            type="button"
                            onClick={() => this.setState({ showModal: false })}
                            className="btn-cancel"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={this.deleteMessageFromConversation(1)}
                            className="btn-active danger"
                          >
                            Delete For Me
                          </button>
                        </Fragment>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </Modal>
          )}
          {showMessageinfo && (
            <Modal divclass="messageInfo" containerId="container">
              <MessageInfo
                groupMemberDetails={groupMemberDetails}
                vCardData={this.props.vCardData}
                messageAction={this.messageAction}
                requestReplyMessage={this.requestReplyMessage}
                viewOriginalMessage={this.viewOriginalMessage}
                groupNickName={groupNickName}
                jid={jid}
                addionalnfo={{
                  ...addionalnfo,
                  messageInfo: true
                }}
                msg={messageInfo}
                chatType={chatType}
                rosterData={this.props.rosterData}
                handleShowMessageinfo={this.handleShowMessageinfo}
                closeMessageOption={this.closeMessageOption}
              />
            </Modal>
          )}
          {this.canSendMessage() && !isAdminBlocked && (
            <WebChatMessagesComposing
              forwardOption = {forwardOption}
              loaderStatus={loaderStatus}
              dragOnContainer={dragOnContainer}
              handleSendMsg={this.handleSendMsg}
              jid={this.props.activeChatId}
              chatType={chatType}
              replyMessage={replyMessage}
              sendMessgeType={sendMessgeType}
              vCardData={this.props.vCardData}
              rosterData={this.props?.rosterData?.data}
              closeReplyAction={this.closeReplyAction}
              groupMemberDetails={groupMemberDetails}
              userReplayDetails={this.state.userReplayDetails}
              avoidRecord={this.props.avoidRecord}
            />
          )}
          <div className={`${mediaLoder ? "conversation-overlay" : ""}`}>
            {mediaLoder && <img src={loaderSVG} alt="message-history" style={style} />}
          </div>
        </div>
        { showReportPopup &&
          <ActionInfoPopup
            textActionBtn={"Report"}
            btnActionClass={"red"}
            textCancelBtn={"Cancel"}
            textHeading={`Report  ${isSingleChat(chatType) ? groupNickName : ""}
            ${isGroupChat(chatType) ? selectedMsgUserName : ""}?`}
            handleAction={(e) => this.reportConfirmAction(e)}
            handleCancel={() => this.setState({ showReportPopup: false })}
            textInfo={<><span>This message will be forwarded to admin.<br></br>This contact will not be notified.</span></>}
          />
        }
      </Fragment>
    );
  }
}

const mapStateToProps = (state) => {
  return {
    featureStateData: state.featureStateData,
    activeChatData: state.activeChatData,
    singleChatMsgHistoryData: state.singleChatMsgHistoryData,
    groupsMemberListData: state.groupsMemberListData,
    messageData: state.messageData,
    groupChatMessage: state.groupChatMessage,
    vCardData: state.vCardData,
    rosterData: state.rosterData,
    blockedContact: state.blockedContact,
    browserTabData: state.browserTabData,
    chatConversationHistory: state.chatConversationHistory,
    selectedMessageData: state.selectedMessageData,
    addMentionedDataReducer: state.addMentionedDataReducer
  };
};

export default connect(mapStateToProps, {
  forwardReset: messageForwardReset,
  scrollBottomChatHistoryAction
})(WebChatConversationHistory);
