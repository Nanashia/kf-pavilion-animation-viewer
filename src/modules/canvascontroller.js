import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { GUI } from 'lil-gui'

import { ModelFactory } from './modelfactory'
import { Animator } from './animator'

export class CanvasController {
	#param
	width
	height

	indexJson

	renderer
	controls
	camera

	objects = []
	gui

	canvasOptions = {
		currentModel: "",
		showGrid: true,
		showAxis: true,
		showSkelton: false,
		showBoxes: false,
		dumpModels: undefined,
	}
	gridHelper
	axisHelper
	axisHelper
	modelFolder

	constructor(param) {
		this.param = param
		this.width = param.width
		this.height = param.height
		
		this.gui = new GUI();
		this.scene = new THREE.Scene()
		this.modelFactory = new ModelFactory()

		this.canvasOptions.dumpModels = () => {
			for(const object of this.objects) {
				console.log(object.model)
			}
		}
	}

	async init() {
		this.setUpRenderer()
		this.setUpCamera()
		this.setUpHelpers()

		const indexJson = await (await fetch("./index.json")).json();
		const mainJson = await (await fetch("./GameObject/main.json")).json();
		this.canvasOptions.currentModel = "./GameObject/" + mainJson.path + ".glb"
		this.setUpModelSelectorGui(indexJson)
		this.indexJson = indexJson

		this.animate()

		this.loadModel("./GameObject/" + mainJson.path + ".glb")

	}


	setUpModelSelectorGui(indexJson) {
		const gui = this.gui.addFolder('Models')
		this.modelFolder = gui;
		this.modelFolder.add(this.canvasOptions, "currentModel")
			.name("File name")
			.onFinishChange((v) => { this.loadModel(v) })

		const models = indexJson.models
		/*
		const sortedModels = []
		for(const model of models) {
			if(model.name.startsWith("ex_") ||
				model.name.startsWith("great_")) {
				const match = model.name.match(/([a-z_]*ex_)([0-9]+)/)
				const category = match[1]
				const number = parseInt(match[1], 0)
			} else {
				
			}
			sortedModels.push({
				
			})
		}*/
		
		const subfolders = []
		const controls = []
		const modelSelector = {}
		const addFolder = (param) => {
			var obj = modelSelector[param.key]
			if(obj == undefined) {
				obj = modelSelector[param.key] = {
					folder: gui.addFolder(param.folderLabel).close()
				}
			}
			if(param.sortKey != undefined) {
				const step = param.step || 10
				const number2 = Math.floor(param.sortKey / step)
				const gui = obj.folder
				const o = obj[""+number2]
				if(o == undefined) {
					const o2 = {}
					subfolders.push({
						gui,
						obj: o2,
						label: `${number2*step} - ${number2*step+step-1}`,
						sortKey: number2,
					})
					obj[""+number2] = o2
					obj = o2
				} else {
					obj = obj[""+number2]
				}
			} 

			obj[param.name] = () => { this.replaceModel(param.name) }
			controls.push({
				obj,
				name: param.name,
				label: param.label || param.name,
				sortKey: param.sortKey ?? "",
			})
		}

		for(const model of models) {
			if(model.name.match("/ex_([0-9]+)")) {
				const number = parseInt(model.name.match(/ex_([0-9]+)/)[1])
				const name_ = indexJson.friend_motion_extends.find(s => s.id === number)
				const name = name_?.name || model.name
				addFolder({	
					name: model.name,
					key: "ex_",
					folderLabel: "　★ Special (Extend motions)",
					label: `　${number}. ${name}`,
					step: 10,
					sortKey: number,
				})
			} else if(model.name.match("/great_")) {
				addFolder({	
					name: model.name,
					key: "great_",
					folderLabel: "　★ Great Toy Motions",
					label: model.name,
				})
			} else if(model.name.match("-obj")) {
				addFolder({	
					name: model.name,
					key: "-obj",
					folderLabel: "　 Toys",
					label: model.name,
				})
			} else if(model.name.match(/[0-9]{9}-001-/)) {
				const match = model.name.match(/([0-9]+)-001-(.*)/)
				const number = parseInt(match[1], 10)
				const sub = match[2]
				const o = indexJson.friends.find(s => s.id === number)
				addFolder({	
					name: model.name,
					key: "friends",
					folderLabel: "　 Friends (Idle motions)",
					label: `　${number}: ${o.name}(${sub})`,
					step: 10 * 1000,
					sortKey: number,
				})
			} else {
				addFolder({	
					name: model.name,
					key: "other",
					folderLabel: "　 Other",
				})
			}
		}
		
		subfolders.sort((a, b) => a.sortKey - b.sortKey)
		controls.sort((a, b) => a.sortKey - b.sortKey)
		for(const folder of subfolders) {
			const f = folder.obj.folder = folder.gui.addFolder(folder.label).close()
		}
		for(const control of controls) {
			control.obj.folder.add(control.obj, control.name).name(control.label)
		}
	}

	async replaceModel(name) {
		console.info(`switching model to ${name}`)
		for(const s of this.modelFolder.controllersRecursive()) s.disable()
		try {
			const unload = this.objects[0]
			await this.loadModel(name)
			if(unload != undefined) {
				this.unloadModel(unload)
				this.objects.shift()
			}
		} catch(e) {
			console.error(e)
		}
		for(const s of this.modelFolder.controllersRecursive()) s.enable()
	}

	async loadModel(pathfbx) {
		const group = new THREE.Group();
		const path = (pathfbx).replace(".fbx", ".glb").replace("#", "%23");
		const { model, animations, cloned } = await this.modelFactory.loadModel(path)
		group.add( model );
		//group.add( cloned );

		model.traverse((child) => {
			if(child.type === "BoxHelper") {
				child.visible = this.canvasOptions.showBoxes
			}
		})

		const skeltonHelper = new THREE.SkeletonHelper(model);
		skeltonHelper.renderOrder = 100000000000
		skeltonHelper.visible = this.canvasOptions.showSkelton
		group.add(skeltonHelper);

		const modelContext = {
			group,
			model,
			animations,
			skeltonHelper,
			animationDispatchTable: undefined,
		}
		const animatorContext = this.setupAnimation(modelContext)

		const context = {
			...modelContext,
			...animatorContext,
		}

		this.scene.add(group)
		this.objects.push(context)
		return context
	}

	setSkeltonHelper(v) {
		for(const object of this.objects) {
			object.skeltonHelper.visible = v
		}
	}

	setBoxHelper(v) {
		for(const object of this.objects) {
			object.model.traverse((child) => {
				if(child.type === "BoxHelper") {
					child.visible = v
				}
			})
		}
	}
	
	unloadModel(modelContext) {
		modelContext.group.removeFromParent()
		this.modelFactory.disposeModel(modelContext.model)
		modelContext.animationDispatchTable.guiFolder.destroy()
	}

	setupAnimation(modelContext) {
		const animator = new Animator(modelContext.group, modelContext.animations, this.gui)

		const folder = this.gui.addFolder( 'Animations' )
		const animationDispatchTable = {
			guiFolder: folder,
		}
		for(const a of modelContext.animations) {
			animationDispatchTable[a.name] = () => animator.play(a.name)
			folder.add( animationDispatchTable, a.name )
				.name(`${a.name} (${animator.detectChannel(a.name)})`);
			folder.add(animator.times, a.name, 0, a.duration)
				.name(`playback time (${a.duration.toPrecision(3)}s)`)
				.listen()
				.disable();
		}
		animator.dispatchAutoPlay()

		return {
			animationDispatchTable,
			animator,
		}
	}

	setUpRenderer() {
		const renderer = new THREE.WebGLRenderer({
			depth: false,
			canvas: this.param.target,
			antialias: false,
			//alpha:true,
		});
		renderer.outputEncoding = THREE.sRGBEncoding;
		renderer.setSize(this.width, this.height); 
		renderer.setPixelRatio( this.param.pixelRatio );
		renderer.setClearColor(0x888888, 1)
		this.renderer = renderer

	}

	setUpHelpers() {
		const size = 10;
		const divisions = 10;
		const gridHelper = new THREE.GridHelper( size, divisions, 0x333333, 0x111111 );
		gridHelper.rotateX(Math.PI/2)
		this.scene.add( gridHelper );

		const axisHelper = new THREE.AxesHelper(5)
		this.scene.add(axisHelper)
		
		const folder = this.gui.addFolder('Display options').close()
		folder.add(this.canvasOptions, 'showGrid')
			.name('Show grids')
			.onChange((v) => gridHelper.visible = v)
		folder.add(this.canvasOptions, 'showAxis')
			.name('Show axis')
			.onChange((v) => axisHelper.visible = v)
		folder.add(this.canvasOptions, 'showSkelton')
			.name('Show skelton')
			.onChange((v) => this.setSkeltonHelper(v))	
		folder.add(this.canvasOptions, 'showBoxes')
			.name('Show boxes')
			.onChange((v) => this.setBoxHelper(v))
		folder.add(this.canvasOptions, 'dumpModels')
			.name('Dump models to console')
	}

	frustumSize = 10
	setUpCamera() {
		const n = 128
		const aspect = this.width / this.height;
		const camera = new THREE.OrthographicCamera(
			this.frustumSize * aspect / - 2, 
			this.frustumSize * aspect / 2, 
			this.frustumSize / 2,  
			this.frustumSize / - 2,  
			-10,
			10 );

		camera.position.set(0, 1, -1)

		const controls = new OrbitControls(camera, this.renderer.domElement)
		controls.enableDamping = true
		controls.target.set(0, 1, 0)
		this.controls = controls;
		this.camera = camera;
	}

	resize(width, height) {
		const aspect = width / height;
		this.camera.left = - this.frustumSize * aspect / 2;
		this.camera.right = this.frustumSize * aspect / 2;
		this.camera.top = this.frustumSize / 2;
		this.camera.bottom = - this.frustumSize / 2;

		this.width = width
		this.height = height

		this.camera.updateProjectionMatrix();
		this.renderer.setSize( width, height );
	}

	animate() {
		const thiz = this
		requestAnimationFrame(function () { thiz.animate() })

		this.controls.update()

		for(const object of this.objects) {
			object.animator.update()
		}

		this.render()
	}

	render() {
		this.renderer.clear()
		this.renderer.render(this.scene, this.camera)
	}

}
