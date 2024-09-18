let peerConnectionConfig = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

let dataChannelOptions = {
	ordered: false,
};

let peerConnection;
let dataChannel;

// Instance for QR Code generation
let localQRCodeInstance;

// Instance for QR code scanning
let html5QrCode;
const qrCodeScanConfig = { fps: 10, qrbox: 250 };

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
			generateLocalQrCode(pc.localDescription.sdp);
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

	if (!sdptext) {
		alert('Remote SDP is empty.');
		return;
	}

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

// QR Code Generation Function
function generateLocalQrCode(sdp) {
	// If there is an existing QR code, delete it
	if (localQRCodeInstance) {
		localQRCodeInstance.clear();
	}

	const element = document.getElementById('localQRCode');

	if (!element) {
		alert('QR Code element not found.');
		return;
	}

	// Generate QR Code
	localQRCodeInstance = new QRCode(element, {
		text: sdp,
		width: 256,
		height: 256,
	});
}

// QR Code Scanner Start Function
async function startQrScanner() {
	const qrReader = document.getElementById('qr-reader');
	const qrResult = document.getElementById('qr-result');

	qrReader.style.display = 'block';
	qrResult.innerHTML = '';

	// Creating an Html5Qrcode instance
	const html5QrCode = new Html5Qrcode('qr-reader');

	// Camera selection (Rear camera preferred)
	Html5Qrcode.getCameras()
		.then((cameras) => {
			if (cameras && cameras.length) {
				// Prioritize rear-facing cameras
				let cameraId = null;
				for (let camera of cameras) {
					if (
						camera.label.toLowerCase().includes('back') ||
						camera.label.toLowerCase().includes('environment')
					) {
						cameraId = camera.id;
						break;
					}
				}

				// If no rear camera is found, use the first camera
				if (!cameraId) {
					cameraId = cameras[0].id;
				}

				// Start QR code scanning
				html5QrCode
					.start(
						cameraId,
						{
							fps: qrCodeScanConfig.fps,
							qrbox: qrCodeScanConfig.qrbox,
						},
						(qrCodeMessage) => {
							// Processing of successful scans
							console.log(`QR Code detected: ${qrCodeMessage}`);
							qrResult.innerHTML = `QR Code Result: ${qrCodeMessage}`;
							document.getElementById('remoteSDP').value = qrCodeMessage;

							// Stop QR code scanning
							html5QrCode
								.stop()
								.then((ignore) => {
									qrReader.style.display = 'none';
									alert('Remote SDP has been set from QR Code.');
								})
								.catch((err) => {
									console.error('Failed to stop QR scanner.', err);
								});
						},
						(errorMessage) => {
							console.log(`QR Code no match: ${errorMessage}`);
						}
					)
					.catch((err) => {
						console.error(`Unable to start QR scanner: ${err}`);
					});
			} else {
				alert('No cameras found.');
			}
		})
		.catch((err) => {
			console.error(`Error getting cameras: ${err}`);
			alert('Error accessing cameras.');
		});
}

function stopQrScanner() {
	if (html5QrCode) {
		html5QrCode
			.stop()
			.then((ignore) => {
				document.getElementById('qr-reader').style.display = 'none';
			})
			.catch((err) => {
				console.error('Failed to stop QR scanner.', err);
			});
	}
}
