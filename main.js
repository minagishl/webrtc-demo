let peerConnectionConfig = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

let dataChannelOptions = {
	ordered: false,
};

let peerConnection;
let dataChannel;

window.onload = function () {
	document.getElementById('status').value = 'closed';
};

function createPeerConnection() {
	let pc = new RTCPeerConnection(peerConnectionConfig);

	pc.onicecandidate = function (evt) {
		if (evt.candidate) {
			console.log(evt.candidate);
			document.getElementById('status').value = 'Collecting ICE candidates';
		} else {
			document.getElementById('localSDP').value = pc.localDescription.sdp;
			document.getElementById('status').value = 'Vanilla ICE ready';
		}
	};

	pc.onconnectionstatechange = function (evt) {
		switch (pc.connectionState) {
			case 'connected':
				document.getElementById('status').value = 'connected';
				break;
			case 'disconnected':
			case 'failed':
				document.getElementById('status').value = 'disconnected';
				break;
			case 'closed':
				document.getElementById('status').value = 'closed';
				break;
		}
	};

	pc.ondatachannel = function (evt) {
		console.log('Data channel created:', evt);
		setupDataChannel(evt.channel);
		dataChannel = evt.channel;
	};

	return pc;
}

function startPeerConnection() {
	peerConnection = createPeerConnection();

	dataChannel = peerConnection.createDataChannel('test-data-channel', dataChannelOptions);
	setupDataChannel(dataChannel);

	peerConnection
		.createOffer()
		.then(function (sessionDescription) {
			console.log('createOffer() succeeded.');
			return peerConnection.setLocalDescription(sessionDescription);
		})
		.then(function () {
			console.log('setLocalDescription() succeeded.');
		})
		.catch(function (err) {
			console.error('setLocalDescription() failed.', err);
		});

	document.getElementById('status').value = 'offer created';
}

function setupDataChannel(dc) {
	dc.onerror = function (error) {
		console.log('Data channel error:', error);
	};
	dc.onmessage = function (evt) {
		console.log('Data channel message:', evt.data);
		let msg = evt.data;
		document.getElementById('history').value =
			'other> ' + msg + '\n' + document.getElementById('history').value;
	};
	dc.onopen = function (evt) {
		console.log('Data channel opened:', evt);
	};
	dc.onclose = function () {
		console.log('Data channel closed.');
	};
}

function setRemoteSdp() {
	let sdptext = document.getElementById('remoteSDP').value;

	if (peerConnection) {
		let answer = new RTCSessionDescription({
			type: 'answer',
			sdp: sdptext,
		});
		peerConnection
			.setRemoteDescription(answer)
			.then(function () {
				console.log('setRemoteDescription() succeeded.');
			})
			.catch(function (err) {
				console.error('setRemoteDescription() failed.', err);
			});
	} else {
		let offer = new RTCSessionDescription({
			type: 'offer',
			sdp: sdptext,
		});
		peerConnection = createPeerConnection();
		peerConnection
			.setRemoteDescription(offer)
			.then(function () {
				console.log('setRemoteDescription() succeeded.');
			})
			.catch(function (err) {
				console.error('setRemoteDescription() failed.', err);
			});
		peerConnection
			.createAnswer()
			.then(function (sessionDescription) {
				console.log('createAnswer() succeeded.');
				return peerConnection.setLocalDescription(sessionDescription);
			})
			.then(function () {
				console.log('setLocalDescription() succeeded.');
			})
			.catch(function (err) {
				console.error('setLocalDescription() failed.', err);
			});
		document.getElementById('status').value = 'answer created';
	}
}

function sendMessage() {
	if (!peerConnection || peerConnection.connectionState != 'connected') {
		alert('PeerConnection is not established.');
		return false;
	}
	let msg = document.getElementById('message').value;
	document.getElementById('message').value = '';

	document.getElementById('history').value =
		'me> ' + msg + '\n' + document.getElementById('history').value;
	dataChannel.send(msg);

	return true;
}
