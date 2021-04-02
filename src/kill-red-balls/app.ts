// import '@babylonjs/core/Debug/debugLayer'
// import '@babylonjs/inspector'
import '@babylonjs/loaders/glTF'

import { Engine, Scene, FreeCamera, Vector3, HemisphericLight, MeshBuilder, SceneLoader, Matrix, Color4, Mesh, Color3, StandardMaterial } from '@babylonjs/core'

enum State { READY = 0, GAME = 1, PAUSE = 2 }
class App {
    // General Entire Application
    private scene: Scene
    private canvas: HTMLCanvasElement
    private engine: Engine
    private camera: FreeCamera
    private light: HemisphericLight
    private plane: any
    private particles: Array<Mesh>
    private pointerPos: any

    private state: number
    public score: number

    constructor() {
        this.init()
    }

    // 初始化 babylon 场景(scene) and 引擎(engin)
    private async init(): Promise<void> {
        this.state = State.READY
        this.score = 0
        this.pointerPos = { x: 0, y: 0}

        this.canvas = this.createCanvas()
        this.engine = new Engine(this.canvas, true, { preserveDrawingBuffer: true, stencil: true,  disableWebGL2Support: false})

        this.scene = new Scene(this.engine)
        this.scene.clearColor = new Color4(229 / 255, 221 / 255, 190 / 255, 1)

        this.camera = new FreeCamera('free-camera', new Vector3(0, 0, -20), this.scene)
        this.camera.setTarget(Vector3.Zero())

        this.light = new HemisphericLight('light', new Vector3(10, 10, -30), this.scene)
        
        this.plane = await this.loadPlane()
        this.plane.fly()

        this.listenKeybord()
        this.listenPlayButton()

        this.main()

    }

    /** 主函数  */
    private async main(): Promise<void> {
        this.scene.onPointerObservable.add(info => {
            const { event } = info
            // 存储鼠标坐标数据
            if (event.type === 'pointermove') {
                this.pointerPos = {
                    x: event.x,
                    y: event.y
                }
            }
        })

        this.scene.registerBeforeRender(() => {
            if (this.state !== State.GAME) return
            this.updateParticles()
            this.updatePlane()
        })

        // 循环
        this.engine.runRenderLoop(() => {
            this.scene.render()
        })

        // 监听浏览器缩放
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

        // 调整到与模型重合的位置
        container.bakeTransformIntoVertices(Matrix.Translation(0, 1.2, 0.8))
        container.rotation.y = -Math.PI / 2
        container.position.x = 0.6

        // 加载飞机模型
        const glb = await SceneLoader.ImportMeshAsync(null, './public/', 'plane.glb', this.scene)
        const root = glb.meshes[0]
        console.log('glb', glb)
        // 绑定父子关系
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

    /** 生成随机形状的粒子 */
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
            
            const material = new StandardMaterial('material', this.scene)
            material.diffuseColor = new Color3(218 / 255, 65 / 255, 46 / 255)
            mesh.material = material
        } else {
            // 圆锥
            const height = .1 + Math.random() * .3
            const diameter = .1 + Math.random() * .3
            mesh = MeshBuilder.CreateCylinder('cone', { height, diameter })
        }

        return mesh
    }

    /** 
     * 生成粒子数据
     * 每个间隔时间生成粒子：并插入到 particles 中
     */
    private initParticles(): void {
        // 限制 scene 最多的粒子为90
        const LIMIT = 90
        this.particles = []
        setInterval(() => {
            if (this.particles.length > LIMIT || this.state !== State.GAME) return
            // 创建粒子
            const particle = this.createParticle()
            // 随机放置粒子
            particle.position.x = 20 + Math.random() * 20
            particle.position.y = -10 + Math.random() * 20
            particle.position.z = 0
            // 粒子插入 particles 中：方便后面更新操作
            this.particles.push(particle)
        }, 300)
    }

    /** Loop中更新粒子数据 */
    private updateParticles(): void {
        // 定义粒子移动速度
        const SPEED = 0.15
        this.particles.forEach((e, index) => {
            // 粒子差不多离开屏幕后，回收重制到初始位置
            if (e.position.x < -20) {
                e.position.x = 20 + Math.random() * 20
            }
            e.position.x -= SPEED
            // 检测粒子是否和 plane 发生碰撞
            const collided = e.intersectsMesh(this.plane.mesh)
            if (collided) {
                this.particles.splice(index, 1)
                e.dispose()
                if (e.name === 'sphere') {
                    this.score++
                    this.updateScore()
                    console.log('collided')
                }
            }
        })
    }
    
    /** Loop中更新plane坐标 */
    private updatePlane(): void {
        // 设置平滑系数-不断尝试得到到数值
        const smoothing = 2000
        // 获取plane屏幕坐标
        const originPos = this.WorldToScreen(this.plane.mesh.position)
        if (this.pointerPos.x && this.pointerPos.y) {
            // 计算鼠标位置 和 plane 位置得距离
            const deltaX = (this.pointerPos.x - originPos.x) / smoothing
            const deltaY = (this.pointerPos.y - originPos.y) / smoothing
            // plane 朝鼠标的方向移动
            this.plane.mesh.position.x += deltaX
            this.plane.mesh.position.y -= deltaY
        }
    }

    private updateScore(): void {
        const dom: HTMLElement = document.querySelector('#score_value')
        dom.innerText = String(this.score)
    }

    private toPlay(): void {
        this.initParticles()
        this.state = State.GAME
    }

    private listenKeybord(): void {
        window.addEventListener('keydown', evt => {
            if (this.state === State.READY) return
            if (evt.code === 'Space') {
                this.state = this.state === State.GAME ? State.PAUSE : State.GAME
            }
        })
    }

    private listenPlayButton(): void {
        const play: HTMLElement = document.querySelector('#play')
        play.addEventListener('mousedown', evt => {
            this.toPlay()
            play.style.display = 'none'
        })
        
    }

    /** 三维世界坐标转化为屏幕坐标 */
    public WorldToScreen(pointer: Vector3): Vector3 {
        return Vector3.Project(
            pointer,
            Matrix.Identity(),
            this.scene.getTransformMatrix(),
            this.camera.viewport.toGlobal(this.engine.getRenderWidth(), this.engine.getRenderHeight())
        )
    }
}
new App()