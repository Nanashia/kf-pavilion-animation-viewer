import { CanvasController } from './modules/canvascontroller'

function init() {
	const canvas = document.querySelector('#mainCanvas')
	const canvasController = new CanvasController({
		target: canvas,
		width: document.body.clientWidth,
		height: window.innerHeight,
		pixelRatio: window.devicePixelRatio,
	})
	canvasController.init()
	
	window.addEventListener( 'resize', () => { 
		canvasController.resize(document.body.clientWidth, window.innerHeight) 
	} );
}

init()
