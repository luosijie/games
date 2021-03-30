import "@babylonjs/core/Debug/debugLayer"
import "@babylonjs/inspector"
import "@babylonjs/loaders/glTF"

import { Engine, Scene, FreeCamera, Vector3, HemisphericLight, MeshBuilder, Animation } from "@babylonjs/core"
// App class is our entire game application
class App {
    // General Entire Application
    private _scene: Scene
    private _canvas: HTMLCanvasElement
    private _engine: Engine
    private _camera: FreeCamera
    private _light: HemisphericLight

    //Game State Related
    public assets

    constructor() {
        this._canvas = this._createCanvas()
        // 初始化 babylon 场景(scene) and 引擎(engin)
        this._init()
    }

    private async _init(): Promise<void> {
        this._engine = new Engine(this._canvas, true)
        this._scene = new Scene(this._engine)

        this._camera = new FreeCamera('camera', new Vector3(0, 5, -10), this._scene)
        this._camera.setTarget(Vector3.Zero())
        this._camera.attachControl(this._canvas, false)

        this._light = new HemisphericLight('light', new Vector3(0, 1, 0), this._scene)

        const box = MeshBuilder.CreateBox('box', { size: 1 }, this._scene)
        box.position.y = 1

        const ground = MeshBuilder.CreateGround('ground', { height: 6, width: 6, subdivisions: 2 }, this._scene)
        
        const frameRate = 10
        const animationBox = new Animation('animation', 'position.x', frameRate, Animation.ANIMATIONTYPE_FLOAT, Animation.ANIMATIONLOOPMODE_CYCLE)

        const keyFrames = []
        keyFrames.push({
            frame: 0,
            value: -2
        })
        keyFrames.push({
            frame: frameRate,
            value: 2
        })
        keyFrames.push({
            frame: 2 * frameRate,
            value: -2
        })

        animationBox.setKeys(keyFrames)
        
        box.animations.push(animationBox)

        this._scene.beginAnimation(box, 0, 2 * 10, true)

        //**for development: make inspector visible/invisible
        window.addEventListener("keydown", (ev) => {
            //Shift+Ctrl+Alt+I
            if (ev.shiftKey && ev.ctrlKey && ev.altKey && ev.keyCode === 73) {
                if (this._scene.debugLayer.isVisible()) {
                    this._scene.debugLayer.hide()
                } else {
                    this._scene.debugLayer.show()
                }
            }
        })

        await this._main()
    }

    private async _main(): Promise<void> {
        // Register a render loop to repeatedly render the scene
        this._engine.runRenderLoop(() => {
            this._scene.render()
        })

        //resize if the screen is resized/rotated
        window.addEventListener('resize', () => {
            this._engine.resize()
        })
    }

    //set up the canvas
    private _createCanvas(): HTMLCanvasElement {

        //Commented out for development
        document.documentElement.style["overflow"] = "hidden"
        document.documentElement.style.overflow = "hidden"
        document.documentElement.style.width = "100%"
        document.documentElement.style.height = "100%"
        document.documentElement.style.margin = "0"
        document.documentElement.style.padding = "0"
        document.body.style.overflow = "hidden"
        document.body.style.width = "100%"
        document.body.style.height = "100%"
        document.body.style.margin = "0"
        document.body.style.padding = "0"

        //create the canvas html element and attach it to the webpage
        this._canvas = document.createElement("canvas")
        this._canvas.style.width = "100%"
        this._canvas.style.height = "100%"
        this._canvas.id = "gameCanvas"
        document.body.appendChild(this._canvas)

        return this._canvas
    }

}
new App()