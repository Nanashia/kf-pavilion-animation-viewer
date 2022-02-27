import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';

export class ModelFactory {
    gltfLoader
    textureLoader


    constructor() {
        this.gltfLoader = new GLTFLoader();
        this.textureLoader = new THREE.TextureLoader();
    }

    async loadModel(path) {

        const fbxCfactor = 100
        
        const traverse = function(o, fn, keys) {
            const traverse_ = (o, fn, keys, obj_parent) => {
                for (var i in o) {
                    var v = o[i]
                    if (v !== null && typeof v === "object") {
                        if(Object.prototype.toString.call(o) !== '[object Array]') {
                            if(keys.includes(i)) {
                                fn.apply(this,[i,v,o]);
                                traverse_(v, fn, keys, o);
                            }
                        } else {
                            fn.apply(this,[i,v,obj_parent]);
                            traverse_(v, fn, keys, obj_parent);
                        }
                    }
                }
            }
            traverse_(o, fn, keys, undefined)
        }  


        const jsonpath = path.substr(0, path.lastIndexOf(".")) + ".fbx.json";
        const basename_ = path.substr(path.lastIndexOf("/") + 1);
        const basename = basename_.substr(0, basename_.lastIndexOf("."));
        
        const json = await (await fetch(jsonpath)).json();
        //console.log(json)

        json.traverse = (fn) => {
            traverse(json.rootTransform, fn, ["children", "gameObject"])
        }

        json.traverse((k, v, parent) => {
            if(v.m_Name != undefined) {
                v.transform = parent
            }
            if(v.children != undefined) {
                v.parent = parent
            }
        })

        const getObject3DByPath = (root, path) => {
            if(path === "") return root
            var split = path.split('/')
            var object3d = root
            if(split[0] === object3d.name) {
                split = split.slice(1)
            }
            for(const nodeName of split) {
                const s = object3d.children.find(s => 
                    s.name === nodeName ||
                    s.name.match(/^(.+)_[0-9]$/)?.[1] === nodeName ||
                    s.name === nodeName.replace(" ", "_"))
                if(s == undefined) {
                    return undefined
                }
                object3d = s
            }
            //console.debug("getObject3DByPath", path, "->", object3d.name)
            return object3d
        }
        
        const getBonePathByObject3D = (obj) => {
            var o = obj
            var name = ""
            while(o.parent != null && o.name != "RootNode") {
                if(name === "") {
                    name = o.name
                } else {
                    name = o.name + '/' + name
                }
                o = o.parent
            }
            //console.debug("getBonePathByObject3D", obj.name, "->", name)
            return name
        }

        const getGameObjectByPath = (path) => {
            const split = path.split('/').slice(1)
            var transform = json.rootTransform
            for(const nodeName of split) {
                const s = transform.children.find(s => 
                    s.gameObject.m_Name === nodeName ||
                    s.gameObject.m_Name === nodeName.match(/^(.+)_[0-9]$/)?.[1] ||
                    s.gameObject.m_Name.replace(" ", "_") === nodeName)
                if(s == undefined) {
                    console.error("Path convertion fail", path)
                    return undefined
                }
                transform = s
            }
            //console.debug("getGameObjectByPath", path, transform.gameObject)
            return transform.gameObject
        }
        
        const getBonePathByGameObject = (obj) => {
            var name = obj.m_Name
            var o = obj.transform?.parent
            while(o != null) {
                name = o.gameObject.m_Name + '/' + name
                o = o.parent
            }
            return name
        }

        console.log(`json data (${jsonpath})`, json)
        
        var object = await new Promise((resolve,reject) => { 
            this.gltfLoader.load( path, 
                function ( object ) { resolve(object) }, 
                undefined, 
                function ( error ) { console.error( error ); reject(error) } );
        });
        const cloned = SkeletonUtils.clone(object.scene.children[0].children[0])
        const wireframeMat = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 1.,
            wireframe: true,
        })
        cloned.traverse((child) => {
            if (child.isMesh) {
                child.material = wireframeMat;
            }
        })

        object.scene.traverse((child) => {
            const path = getBonePathByObject3D(child)
            child.userData.gameObject = getGameObjectByPath(path)
        })
        console.log("gltf loaded:", object)


        
        console.group("object instantiations")
        const sprites = [];
        
        const o = getObject3DByPath(object.scene, "RootNode/" + basename);
        //o.scale.set(1, 1, -1);
        

        const cachedTextures = new Map()

        const createMaterial = async (texname, alphatexname) => {
            var cachedTexture = undefined //cachedTextures.get(texname);
            var tex = undefined
            var atex = null
            var mat = undefined
            if(cachedTexture == undefined) {
                const texturePath = './Texture2D/' + texname + '.png';
                const texture = await new Promise((resolve,reject) => { 
                    this.textureLoader.load(texturePath, 
                        function ( object ) { resolve(object) }, 
                        undefined, 
                        ( error ) => { console.error( error ); reject(error) }
                    )
                });
                console.info("texture loaded: ", texturePath)
                texture.encoding = THREE.sRGBEncoding;
                texture.flipY = false
                texture.name = texname
                
                cachedTextures.set(texname, texture)
                tex = texture

                if(alphatexname != null) {
                    const alphatexturePath = './Texture2D/' + alphatexname + '.png';
                    const alphatexture = await new Promise((resolve,reject) => { 
                        this.textureLoader.load(alphatexturePath, 
                            function ( object ) { resolve(object) }, 
                            undefined, 
                            ( error ) => { console.error( error ); reject(error) }
                        )
                    });
                    console.info("texture loaded: ", alphatexturePath)
                    texture.encoding = THREE.sRGBEncoding;
                    alphatexture.name = alphatexname
                    alphatexture.flipY = true 
                    atex = alphatexture
                }
            } else {
                tex = cachedTexture.clone()
            }
            var onAfterRender = undefined
            if(texname.startsWith("water_reverseMask")) {
                const material = new THREE.MeshBasicMaterial({
                    name: "water_reverseMask",
                    transparent: true,
                    side: THREE.DoubleSide,
                    colorWrite: false,
                    stencilWrite: true,
                    stencilFunc: THREE.AlwaysStencilFunc,
                    stencilFail: THREE.IncrementStencilOp,
                    stencilZFail: THREE.IncrementStencilOp,
                    stencilZPass: THREE.IncrementStencilOp,
                })
                mat = material
                console.debug("water: ", mat)
            } else {
                const material = new THREE.MeshBasicMaterial({
                    map: tex, 
                    alphaMap: atex,
                    color: 0xffffff,
                    transparent: true,
                    side: THREE.DoubleSide,
                    opacity: 1.,
                    stencilWrite: true,
                    stencilRef: 0,
                    stencilFunc: THREE.EqualStencilFunc,
                })
                mat = material
            }
            //console.debug(texname, mat, tex)


            return [mat, tex, ]
        }

        const instantiateSprite = async (object3d, sprite) => {
            var at = undefined
            if(sprite.m_RD.alphaTexture2d != null) {
                at = sprite.m_RD.alphaTexture2d.m_Name + "_" + sprite.m_RD.alphaTexture2d.m_PathID.toString().substr(0, 5)
            }
            const [mat, tex] = await createMaterial(sprite.m_RD.texture2d.m_Name + "_" + sprite.m_RD.texture.m_PathID.toString().substr(0, 5), at)
            const material3 = mat
            
            var rect = sprite.m_RD.textureRect;
            tex.flipY = true
            tex.offset = new THREE.Vector2(rect.x / tex.image.width, rect.y / tex.image.height)
            tex.repeat = new THREE.Vector2(rect.width / tex.image.width, rect.height / tex.image.height)
            
            /*
            const s = new THREE.Sprite( material );
            s.position.set(sprite.m_Rect.x / 4096 / 2 / 2, sprite.m_Rect.y / 4096 /2 / 2, 0)
            s.scale.set(sprite.m_Rect.width / 128, sprite.m_Rect.height / 128, 1)
            */
        
            const left = sprite.m_Rect.width * sprite.m_Pivot.X + sprite.m_RD.textureRectOffset.X;
            const up = sprite.m_Rect.height * sprite.m_Pivot.Y + sprite.m_RD.textureRectOffset.Y;
            const w = sprite.m_RD.textureRect.width
            const h = sprite.m_RD.textureRect.height
            const right = sprite.m_Rect.width - w - left
            const down = sprite.m_Rect.height - h - up
            
            /*
            console.log(`m_Pivot.X:${sprite.m_Pivot.X} m_Pivot.Y:${sprite.m_Pivot.Y} `)
            console.log(`sprite r.x:${sprite.m_Rect.x} r.y:${sprite.m_Rect.y} r.width:${sprite.m_Rect.width} r.height:${sprite.m_Rect.height}`)
            console.log(`textureRect.x:${sprite.m_RD.textureRect.x} textureRect.y:${sprite.m_RD.textureRect.y}`)
            console.log(`textureRect.width:${sprite.m_RD.textureRect.width} textureRect.height:${sprite.m_RD.textureRect.height} `)
            console.log(`textureRectOffset.X:${sprite.m_RD.textureRectOffset.X} textureRectOffset.Y:${sprite.m_RD.textureRectOffset.Y} `)
            console.log(`atlasRectOffset.X:${sprite.m_RD.atlasRectOffset.X} atlasRectOffset.Y:${sprite.m_RD.atlasRectOffset.Y} `)
*/

            const r = sprite.m_Rect
            const tr = sprite.m_RD.textureRect;

            const x = r.width/2-tr.width/2 -sprite.m_RD.textureRectOffset.X
            const y = -r.height/2+tr.height/2 +sprite.m_RD.textureRectOffset.Y

            //console.log(`x:${x} y:${y}  ::: x:${x / fbxCfactor} y:${y / fbxCfactor}`)
   

            const geometry = new THREE.PlaneGeometry( 
                w / fbxCfactor, 
                h / fbxCfactor);
            const s = new THREE.Mesh( geometry, material3 );
            s.name = sprite.m_Name
            s.position.set(
                x / fbxCfactor, 
                y / fbxCfactor, 0);
            s.scale.set(-1, 1, 1);
            const o = new THREE.Mesh( 
                new THREE.PlaneGeometry( 
                    r.width / fbxCfactor, 
                    r.height / fbxCfactor), 
                new THREE.MeshBasicMaterial({
                    transparent: true,
                    color: 0xffffff,
                    opacity: 0.0,
            }));

            s.add(o)

            const box2 = new THREE.BoxHelper( o, 0xffffff );
            box2.renderOrder = 1000000
            s.add(box2)

            const order = resolveRenderOrderChain(object3d);
            if(object3d.userData.renderOrder != undefined) {
                s.renderOrder = calcRenderOrder(object3d.userData.renderOrder)
            }
            
            if(tex.name.startsWith("water_reverseMask")) {
                const material = new THREE.MeshBasicMaterial({
                    name: "water_reverseMask2",
                    transparent: true,
                    side: THREE.DoubleSide,
                    colorWrite: false,
                    stencilWrite: true,
                    stencilFunc: THREE.AlwaysStencilFunc,
                    stencilFail: THREE.DecrementStencilOp,
                    stencilZFail: THREE.DecrementStencilOp,
                    stencilZPass: THREE.DecrementStencilOp, 
                })
                const clearMesh = new THREE.Mesh( geometry, material )
                const clearOrder = object3d.userData.renderOrder.slice()
                clearOrder[clearOrder.length - 1].order += 20 // +20 order (fixed value?)
                clearMesh.name = "[patching stencil]"
                clearMesh.renderOrder = calcRenderOrder(clearOrder) 
                clearMesh.userData.renderOrder = clearOrder
                s.add(clearMesh)
                
            }

            if(s.name == "friends_shadow") {
                // ???
                s.scale.set(0.25, 0.25, 1)
            }
/*
            //s.name = name;
            sprites.push({
                name,
                sprite :s,
                o,
            })
            */
            object3d.add(s)
            console.log(`instantiate ${s.name} to ${getBonePathByObject3D(object3d)} (ro:${s.renderOrder})`, s);
            return s
        }

        var resolveRenderOrderChain = (child) => {
            const g = child.userData.gameObject
            if(g == undefined) {
                return undefined
            }

            var chain = []
            var t = g.transform
            const o = [
                t.gameObject?.m_SkinnedMeshRenderer?.m_SortingOrder,
                t.gameObject?.m_SpriteRenderer?.m_SortingOrder,
                t.gameObject?.m_MonoBehaviour?.m_SortingOrder,
                0,
            ].find(s => s != undefined)
            //console.debug("resolveRenderOrderChain0", t.gameObject.m_Name, t.gameObject)
            chain.push({ 
                order: o,
                gameObject: g,
            })

            // find sorting groups
            var ro = o
            var lat = 1
            while(t != undefined) {
                var o2 = t.gameObject?.m_SortingGroup?.m_SortingOrder
                if(o2 != undefined) {
                    //console.debug("resolveRenderOrderChain", t.gameObject.m_Name, t.gameObject, o2, ro)
                    chain.unshift({
                        order: o2,
                        gameObject: t.gameObject,
                    })
                    ro = o2 + ro / 100000.
                    lat /= 100000
                } else {
                }
                t = t.parent
            }
            child.userData.renderOrder = chain
            
            return ro
        }

        const calcRenderOrder = (chain) => {
            return chain.map(s => s.order).reverse().reduce((a, b) => a / 10000. + b)
        }


        {
            console.groupCollapsed("material setting")
            const newmaterials = []
            const textures = new Map()
            o.traverse((child) => {
                if (child.isMesh) {
                    const texname = child?.material?.map?.name
                    if(texname != undefined) {
                        newmaterials.push([child, texname])
                    }

                    const sprite = child?.userData?.gameObject?.m_MonoBehaviour?.spriteMesh?.sprite;
                    if(sprite != undefined) {
                        textures.set(sprite.m_RD.texture2d.m_Name, 
                            sprite.m_RD.texture2d.m_Name + "_" + sprite.m_RD.texture.m_PathID.toString().substr(0, 5))
                    }
                }
            })
            for(const [child, texname] of newmaterials) {
                const [mat, tex] = await createMaterial(textures.get(texname))
                child.material = mat
                console.debug(child.name, texname, mat, child)
            }
            console.groupEnd()
        }

        {

            console.groupCollapsed(" ::: sprite instantiate ::: ")
            const newsprites = []
            o.traverse((child) => {
                const r = child?.userData?.gameObject?.m_SpriteRenderer?.sprite
                if(r != undefined) {
                    newsprites.push([child, r])
                }
                const s = child?.userData?.gameObject?.m_MonoBehaviour?.spriteMesh?.sprite
                if(child?.userData?.gameObject?.m_SkinnedMeshRenderer == undefined &&
                    s != undefined) {
                    newsprites.push([child, s])
                }
            })
            for(const [object3d, r] of newsprites) {
                object3d.userData.defaultSprite = await instantiateSprite(object3d, r);

            }

            console.log(" ::: instances for animation :::")
            for(const spriteData of json.sprites) {
                // Instantiate for animation
                const path = spriteData.path
                if(path == null) {
                    console.warn(`path is null`, spriteData)
                    continue
                }
                const targetObject3D = getObject3DByPath(o, path)
                const s = await instantiateSprite(targetObject3D, spriteData.sprite);
                s.visible = false
            }
            
            console.groupEnd()
        }
        console.groupEnd()


        console.group("object adjustment")
        
        {
            console.groupCollapsed("setting visibility")
            o.traverse((child) => {
                if(child.userData.gameObject != undefined) {
                    if(child.userData.gameObject.m_IsActive === false) {
                        child.visible = false
                        console.log(`set visible(${getBonePathByObject3D(child)}, ${child.visible}) `, child)
                    }
                }
            })
            console.groupEnd()
        }
        
        {
            console.groupCollapsed("resolve rendering orders")
            const orderList = []
            o.traverse(function (child) {
                var order = resolveRenderOrderChain(child)
                if(child?.userData?.renderOrder != undefined) {
                    child.renderOrder = calcRenderOrder(child.userData.renderOrder)
                    console.log(`set order=${child.renderOrder} to ${getBonePathByObject3D(child)} `);
                }

                if(child.isMesh) {
                    
                    // SPECIAL
                    if(child.name === "friends_shadow") {
                        child.renderOrder -= 1
                    }
                }


                if(child.isMesh && (child?.userData?.renderOrder != undefined || 
                    child?.parent?.userData?.renderOrder != undefined)) {
                    orderList.push(child)
                }

            })

            console.groupEnd()
            
            console.groupCollapsed("rendering order ranking")
            orderList.sort((a, b) => a.renderOrder - b.renderOrder)
            for (const orderObj of orderList) {
                console.debug(orderObj.renderOrder, 
                    getBonePathByObject3D(orderObj), 
                    (orderObj.userData?.renderOrder || orderObj?.parent?.userData?.renderOrder)?.map(s => s.order))
            }
            console.groupEnd()
        }
        console.groupEnd()
        console.groupCollapsed("Object3D " + basename + ":", o)
        o.traverse( function (obj) {
            var s = '+--';
            var obj2 = obj;
            while ( obj2 !== o ) {
                s = '\t' + s;
                obj2 = obj2.parent;
            }
            console.info(`${s} "${obj.name}" <${obj.type}> ${obj.visible? "": "hidden"} ${getBonePathByObject3D(obj)}`);
        } );
        console.groupEnd()

        // animation
        console.group("animation logs")
        const clips = json.animationclips;
        for (const [key, value] of Object.entries(clips)) {
            var a = object.animations.find((v) => v.name === key);
            if(a == undefined) {
                a = new THREE.AnimationClip(key, -1, [])
                object.animations.push(a)
            }

            const clip = value
            const map = value.pptrCurveMapping            
            console.group(`============  clip: ${key} ================`)
            console.debug("pptrCurveMapping:", map)

            for(const [targets, track] of Object.entries(value.tracks)) {
                console.log(`    ***** target ${targets} ***** `)
                const targets2 = targets.replace(" ", "_")
                const targetObj = getObject3DByPath(o, targets2)
                if(targetObj == undefined) {
                    console.error("unknown target", targets2)
                    continue
                }
                const targetPath = getBonePathByObject3D(targetObj)

                const keys = new Map();
                var priv = undefined
                for(const keyframe of track.keyframes) {
                    if(keyframe.binding.typeID === 212 && keyframe.binding.isPPtrCurve === 1) {
                        const key = targetPath + "/" + map[keyframe.value] + ".visible"

                        if(priv == undefined) {
                            const defaultKey = getBonePathByObject3D(targetObj.userData.defaultSprite) + ".visible";
                            const initKey = targetPath + "/" + map[keyframe.value-1] + ".visible"

                            if(defaultKey !== initKey) {
                                const v = {
                                    times: [0],
                                    values: [false],
                                    type: "bool",
                                }
                                keys.set(defaultKey, v)
                                console.debug(`t=${0} keyframe 212 default key=${defaultKey} -> ${false}`)
                            }

                            priv = {
                                times: [0],
                                values: [true],
                                type: "bool",
                            }
                            keys.set(initKey, priv)
                            console.debug(`t=${0} keyframe 212 [-1] key=${initKey} -> true ${keyframe.value-1}(=${map[keyframe.value-1]})`)
                        }

                        if(!keys.has(key)) {
                            keys.set(key, {
                                times: [0],
                                values: [false],
                                type: "bool",
                            })
                            console.debug(`t=${0} keyframe 212 0f key=${key} -> false ${keyframe.value}(=${map[keyframe.value]})`)
                        }
                        
                    }
                }


                for(const keyframe of track.keyframes) {
                    const time = keyframe.time
                    if(keyframe.binding.typeID === 212 && keyframe.binding.isPPtrCurve === 1) {
                        const key = targetPath + "/" + map[keyframe.value] + ".visible"
                        const t = keys.get(key)
                        
                        priv.times.push(time)
                        priv.values.push(false)
                        
                        t.times.push(time)
                        t.values.push(true)
                        //console.debug(`t=${time} keyframe[sprite] key=${key} -> ${keyframe.value}(=${map[keyframe.value]})`)

                        priv = t
                        
                    } else if(keyframe.binding.typeID === 212 && keyframe.binding.isPPtrCurve === 0) {
                        const key = getBonePathByObject3D(targetObj.userData.defaultSprite) + ".material.opacity";
                        //const key = targetObj.userData.defaultSprite.uuid + ".material.opacity";

                        if(!keys.has(key)) {
                            const n = {
                                times: [],
                                values: [],
                                type: "int_linear",
                            }
                            if(time !== 0) {
                                n.times.push(0)
                                n.values.push(1.0)
                                console.debug(`t=${0} keyframe[opacity]/0f key=${key} val=${n.values[0]}`)
                            }
                            keys.set(key, n)
                        }

                        const t = keys.get(key)
                        t.times.push(time)
                        t.values.push(keyframe.value)
                        console.debug(`t=${time} keyframe[opacity] key=${key} -> ${keyframe.value}`)
                        
                    } else if((keyframe.binding.typeID === 1 && keyframe.binding.attribute === 2086281974)/* ||
                        (keyframe.binding.typeID === 210 && keyframe.binding.attribute == 3305885265)*/) {
                        const key = getBonePathByObject3D(targetObj) + ".visible";
                        if(!keys.has(key)) {
                            const n = {
                                times: [],
                                values: [],
                                type: "bool",
                            }
                            if(time !== 0) {
                                n.times.push(0)
                                n.values.push(targetObj.visible)
                                console.debug(`t=${0} keyframe[visible] 0 val=${targetObj.visible} ${key}`)
                            }
                            keys.set(key, n)
                        }
                        const t = keys.get(key)
                        
                        if(keyframe.value === 1) {
                            t.times.push(time)
                            t.values.push(true)
                        } else if(keyframe.value === 0) {
                            t.times.push(time)
                            t.values.push(false)
                        } 
                        
                        console.debug(`t=${time} keyframe[visible] key=${key} attr=${keyframe.binding.attribute} val=${keyframe.value}`)

                    } else if(keyframe.binding.typeID === 4 && keyframe.binding.attribute === 3) {
                        const x = targetPath + ".scale[y]";
                        if(!keys.has(x)) {
                            const t = {
                                times: [],
                                values: [],
                                type: "int",
                            }
                            keys.set(x, t)
                            if(time !== 0) {
                                t.times.push(time)
                                t.values.push(targetObj.scale.y)
                            }
                            //console.debug(`t=${time} keyframe[scale0] key=${x} val=${targetObj.scale.y}`)
                        }
                        const t = keys.get(x)
                        
                        t.times.push(time)
                        //t.values.push(keyframe.value)
                        t.values.push(keyframe.value2)
                        //t.values.push(keyframe.value3)
                        
                        console.debug(`t=${time} keyframe[scale] key=${x} -> val=${keyframe.value},${keyframe.value2},${keyframe.value3}`)

                    } else if(keyframe.binding.typeID === 4 && keyframe.binding.attribute === 1) {
                        if(false) {

                            const x = targetPath + ".position";
                            if(!keys.has(x)) {
                                const t = {
                                    times: [],
                                    values: [],
                                    type: "vector",
                                }
                                keys.set(x, t)
                                /*if(time !== 0) {
                                    t.times.push(time)
                                    t.values.push(targetObj.scale.y)
                                    t.values.push(targetObj.scale.y)
                                    t.values.push(targetObj.scale.y)
                                }*/
                            }
                            const t = keys.get(x)
                            
                            t.times.push(time)
                            t.values.push(keyframe.value / fbxCfactor)
                            t.values.push(keyframe.value2 / fbxCfactor)
                            t.values.push(keyframe.value3 / fbxCfactor)
                        }
                        //console.debug(`t=${time} keyframe[translate] key=${targets2} val=${keyframe.value},${keyframe.value2},${keyframe.value3} type=${keyframe.binding.typeID} attr=${keyframe.binding.attribute}`)
                    } else if(keyframe.binding.typeID === 4 && keyframe.binding.attribute === 4) {
                        if(false) {
                            const x = targetPath + ".quaternion";
                            if(!keys.has(x)) {
                                const t = {
                                    times: [],
                                    values: [],
                                    type: "quat",
                                }
                                keys.set(x, t)
                                /*if(time !== 0) {
                                    t.times.push(time)
                                    t.values.push(targetObj.scale.y)
                                }*/
                            }
                            const t = keys.get(x)
                                            
                            const c1 = Math.cos( keyframe.value  * Math.PI / 180 / 2 );
                            const c2 = Math.cos( keyframe.value2 * Math.PI / 180 / 2 );
                            const c3 = Math.cos( keyframe.value3 * Math.PI / 180 / 2 );
                            const s1 = Math.sin( keyframe.value  * Math.PI / 180 / 2 );
                            const s2 = Math.sin( keyframe.value2 * Math.PI / 180 / 2 );
                            const s3 = Math.sin( keyframe.value3 * Math.PI / 180 / 2 );
                            t.times.push(time)
                            t.values.push(s1 * c2 * c3 + c1 * s2 * s3)
                            t.values.push(c1 * s2 * c3 - s1 * c2 * s3)
                            t.values.push(c1 * c2 * s3 + s1 * s2 * c3)
                            t.values.push(c1 * c2 * c3 - s1 * s2 * s3)
                        }
                        //console.debug(`t=${time} keyframe[rotation] key=${targets2} val=${keyframe.value},${keyframe.value2},${keyframe.value3} type=${keyframe.binding.typeID} attr=${keyframe.binding.attribute}`)
                    } else if(keyframe.binding.typeID === 4 && keyframe.binding.attribute === 2) {
                        //console.debug(`t=${time} keyframe[transform] key=${targets2} val=${keyframe.value},${keyframe.value2},${keyframe.value3} type=${keyframe.binding.typeID} attr=${keyframe.binding.attribute}`)
                        
                    } else {
                        console.warn(`t=${time} keyframe[???] key=${targets2} val=${keyframe.value},${keyframe.value2},${keyframe.value3} type=${keyframe.binding.typeID} attr=${keyframe.binding.attribute}`)
                    }
                    
                }

                for(const [key, value] of keys.entries()) {
                    const name = key.substr(0, key.indexOf('.', key.lastIndexOf('/')))
                    const attribute = key.substr(key.indexOf('.', key.lastIndexOf('/')))
                    
                    const obj = getObject3DByPath(o, name)
                    if(obj != undefined) {
                        const path = obj.uuid + "" + attribute
                        console.debug(`KEY: ${name}${attribute} -> ${path}`, value)
                        if(value.type == "bool") {
                            a.tracks.push(new THREE.BooleanKeyframeTrack(path, value.times, value.values))
                        } else if(value.type === "int") {
                            a.tracks.push(new THREE.NumberKeyframeTrack(path, value.times, value.values, THREE.InterpolateDiscrete))
                        } else if(value.type === "int_linear") {
                            a.tracks.push(new THREE.NumberKeyframeTrack(path, value.times, value.values, THREE.InterpolateLinear))
                        } else if(value.type === "vector") {
                            a.tracks.push(new THREE.VectorKeyframeTrack(path, value.times, value.values, THREE.InterpolateLinear))
                        } else if(value.type === "quat") {
                            a.tracks.push(new THREE.QuaternionKeyframeTrack(path, value.times, value.values, THREE.InterpolateLinear))
                        }
                        a.resetDuration()
                        console.log("durations: ", a.duration, clip.duration)
                        /*
                        a.duration = Math.max(a.duration, clip.duration || 0)
                        if(a.duration == NaN) {
                            throw new Error("a.duration is Nan")
                        }
                        */
                    } else {
                        console.error(`${name} does not exist ${key}`, value)
                    }
                }  
            }

            if(a.tracks.size === 0 && map.length === 1) {
                const defaultKey = getBonePathByObject3D(targetObj.userData.defaultSprite) + ".visible";
                const initKey = targetPath + "/" + map[0] + ".visible"

                if(defaultKey !== initKey) {
                    const v = {
                        times: [0],
                        values: [false],
                        type: "bool",
                    }
                    keys.set(defaultKey, v)
                    console.debug(`t=${0} keyframe 212 default key=${defaultKey} -> ${false}`)
                }

                priv = {
                    times: [0],
                    values: [true],
                    type: "bool",
                }
                keys.set(initKey, priv)
                console.debug(`t=${0} keyframe 212 [-1] key=${initKey} -> true (=${map[0]})`)
            }
            
            
            console.groupEnd()
        }
        console.groupEnd()

        console.log("animations:");
        console.log(object.animations);



        return {
            animations: object.animations,
            model: o,
            cloned,
        }
    }

    disposeModel(model) {
		model.traverse((child) => {
            if(child.geometry != undefined) {
                child.geometry.dispose()
            }
            if(child.material?.map != undefined) {
                child.material?.map.dispose()
            }
		})
    }

}
