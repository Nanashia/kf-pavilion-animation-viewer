import * as THREE from 'three';

export class Animator {
    mixer
    model
    animations
    clock
    actions

    gui
    times

    constructor(model, animations, gui) {
        this.model = model
        this.animations = animations

        this.mixer = new THREE.AnimationMixer(this.model)
        this.mixer.addEventListener( 'loop', function( e ) { } )

        this.clock = new THREE.Clock()
        this.actions = new Map()
        this.channels = new Map()

        this.gui = gui
        this.times = {}
        
		for(const a of animations) {
            this.times[a.name] = 0
        }
    }

    play(name) {
        const channel = this.detectChannel(name)
        for(const a of this.animations) {
            if(a.name === name) {
                const animationAction = this.mixer.clipAction(a)
                animationAction.play()
                this.actions.set(a.name, animationAction)
                
                if(channel != undefined) {
                    var a3 = this.channels.get(channel)
                    if(a3 != undefined) {
                        a3.stop()
                    }
                    if(a3 !== animationAction) {
                        this.channels.set(channel, animationAction)
                    } else {
                        this.channels.set(channel, undefined)
                    }
                }   

            }
        }
    }

    stop(name) {

    }

    detectChannel(name) {
        const prefixes = [
            "ani_",
            "ani-",
            "ex_",
            "great_ex_",

        ]
        if(prefixes.find(s => name.startsWith(s)) != undefined) {
            if(!name.match(/[a-zA-Z]$/g)) {
                return "main"
            }
        }

        if([
            "Stand-",
            "Sit",
            "Walk"
        ].find(s => name.startsWith(s)) != undefined) {
            return "main"
        }

        
        if(name.match(/ex[0-9]{9}/g)) {
            return "main"
        }

        const match = name.match(/([0-9]{9}-(?:sp-?[0-9]{1,2}|ex-?[0-9]{1,2}|[a-z]+))-[0-9b]{1,2}$/)
        if(match) {
            return match[1]
        }

        return name
    }

    dispatchAutoPlay() {
        if(this.animations.length === 1) {
            const a = this.animations[0]
            this.play(a.name)
        } else {
            for(const a of this.animations) {
                const keywords = [
                    "toy",
                    "tail",
                    "ear",
                    "hair",
                    "display",
                   
                ]
                if(keywords.find(s => a.name.includes(s)) != undefined) {
                    this.play(a.name)
                    continue
                }

                if([
                    "Stand-normal",
                ].find(s => a.name === s) != undefined) {
                    this.play(a.name)
                    continue
                }

                if(a.name.match(/(_|-|sp)0?0?1$/)) {
                    this.play(a.name)
                    continue
                }
                
                if(a.name.match(/ex_?[0-9]$/)) {
                    this.play(a.name)
                    continue
                }
            }
        }
    }

    update() {
	    this.mixer.update(this.clock.getDelta())
        for(const [k, v] of this.actions.entries()) {
            this.times[k] = v.time
        }
    }
  }