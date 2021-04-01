// import '@babylonjs/core/Debug/debugLayer'
// import '@babylonjs/inspector'
import '@babylonjs/loaders/glTF'

import { Engine, Scene, FreeCamera, Vector3, HemisphericLight, MeshBuilder, SceneLoader, Matrix, Color4, ParticleSystem, CannonJSPlugin, ParticleHelper, SolidParticle, SolidParticleSystem, Scalar, Mesh, Color3, StandardMaterial } from '@babylonjs/core'
// App class is our entire game application
class App {
    // General Entire Application
    private scene: Scene
    private canvas: HTMLCanvasElement
    private engine: Engine
    private camera: FreeCamera
    private light: HemisphericLight
    private plane: any
    private particles: Array<Mesh>

    //Game State Related
    public assets

    constructor() {
        this.canvas = this.createCanvas()
        // 初始化 babylon 场景(scene) and 引擎(engin)
        this.init()
    }

    private async init(): Promise<void> {
        this.engine = new Engine(this.canvas, true, { preserveDrawingBuffer: true, stencil: true,  disableWebGL2Support: false})
        this.scene = new Scene(this.engine)
        this.scene.clearColor = new Color4(229 / 255, 221 / 255, 190 / 255, 1)

        this.camera = new FreeCamera('free-camera', new Vector3(0, 0, -25), this.scene)
        this.camera.setTarget(Vector3.Zero())

        this.light = new HemisphericLight('light', new Vector3(10, 10, -30), this.scene)
        
        this.plane = await this.loadPlane()
        this.plane.fly()

        // const particle = this.createParticle()
        // this.particles.push(particle)
        this.initParticles()
        // ParticleHelper.CreateDefault(new Vector3(0, 0, 1)).start()

        await this.main()
    }

    // 主循环函数
    private async main(): Promise<void> {
        this.scene.registerBeforeRender(() => {
            this.updateParticles()
        })

        // Register a render loop to repeatedly render the scene
        this.engine.runRenderLoop(() => {
            this.scene.render()
        })

        //resize if the screen is resized/rotated
        window.addEventListener('resize', () => {
            this.engine.resize()
        })
    }

    // 创建canvas
    private createCanvas(): HTMLCanvasElement {
        this.canvas = document.createElement('canvas')
        this.canvas.style.width = '100%'
        this.canvas.style.height = '100%'
        this.canvas.id = 'game'
        document.body.appendChild(this.canvas)
        return this.canvas
    }

    // 加载飞机模型
    private async loadPlane(): Promise<any> {
        // 新建一个透明元素 包裹模型
        const container = MeshBuilder.CreateBox('plane-container', { width: 1, depth: 2, height:1 }, this.scene)
        container.isVisible = false;
        container.isPickable = false;
        container.checkCollisions = true;

        // container.ellipsoid = new Vector3(1, 1.5, 1);
        // container.ellipsoidOffset = new Vector3(0, 1.5, 0);
        container.bakeTransformIntoVertices(Matrix.Translation(0, 1.2, 0.8))
        container.rotation.y = -Math.PI / 2

        const glb = await SceneLoader.ImportMeshAsync(null, './public/', 'plane.glb', this.scene)
        const root = glb.meshes[0]
        root.parent = container

        return {
            mesh: container,
            fly: () => {
                glb.animationGroups[0].play(true)
                glb.animationGroups[1].play(true)
            },
            stop: () => {
                glb.animationGroups[0].stop(),
                glb.animationGroups[1].stop()
            }
        }
    }

    private createParticle(): Mesh {
        let mesh
        const r = Math.random()

        if (r < .33) {
            // 正方形
            const width = .1 + Math.random() * .3
            const height = .1 + Math.random() * .3
            const depth = .1 + Math.random() * .3
            mesh = MeshBuilder.CreateBox('box', { width, height, depth })
        } else if (r < 0.66) {
            // 球
            const diameter = .1 + Math.random() * .3
            mesh = MeshBuilder.CreateSphere('sphere', { diameter })
        } else {
            // 圆锥
            const height = .1 + Math.random() * .3
            const diameter = .1 + Math.random() * .3
            mesh = MeshBuilder.CreateCylinder('cone', { height, diameter })
        }
        const material = new StandardMaterial('material', this.scene)
        material.diffuseColor = new Color3(1, 1, 1)

        mesh.material = material

        return mesh
    }

    private initParticles(): void {
        this.particles = []
        setInterval(() => {
            if (this.particles.length > 90) return
            const particle = this.createParticle()
            particle.position.x = 20 + Math.random() * 20
            particle.position.y = -10 + Math.random() * 20
            particle.position.z = 0
            this.particles.push(particle)
        }, 300)
    }

    private updateParticles(): void {
        this.particles.forEach((e, index) => {
            if (e.position.x < -20) {
                e.position.x = 20 + Math.random() * 20
                // e.dispose()
                // this.particles.splice(index, 1)
            }
            e.position.x -= 0.15
            const collided = e.intersectsMesh(this.plane.mesh)
            if (collided) {
                console.log('collided', 1)
                this.particles.splice(index, 1)
                e.dispose()
            }
        })
    }
 
}
new App()