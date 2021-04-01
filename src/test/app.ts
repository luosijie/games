import "@babylonjs/core/Debug/debugLayer";
import "@babylonjs/inspector";
import "@babylonjs/loaders/glTF";

import { Engine, Scene, Vector3, Mesh, Color3, Color4, ShadowGenerator, GlowLayer, PointLight, FreeCamera, CubeTexture, Sound, PostProcess, Effect, SceneLoader, Matrix, MeshBuilder, Quaternion } from "@babylonjs/core";
import { PlayerInput } from "./inputController";
import { Player } from "./characterController";
import { Hud } from "./ui";
import { AdvancedDynamicTexture, StackPanel, Button, TextBlock, Rectangle, Control, Image } from "@babylonjs/gui";
import { Environment } from "./environment";

//enum for states
enum State { START = 0, GAME = 1, LOSE = 2, CUTSCENE = 3 }

// App class is our entire game application
class App {
    // General Entire Application
    private _scene: Scene;
    private _canvas: HTMLCanvasElement;
    private _engine: Engine;

    //Game State Related
    public assets;
    private _input: PlayerInput;
    private _player: Player;
    private _ui: Hud;
    private _environment;

    //Sounds
    // public sfx: Sound;
    public game: Sound;
    public end: Sound;

    //Scene - related
    private _state: number = 0;
    private _gamescene: Scene;
    private _cutScene: Scene;

    //post process
    private _transition: boolean = false;

    constructor() {
        this._canvas = this._createCanvas();

        // 初始化 babylon 场景(scene) and 引擎(engin)
        this._init();
    }

    private async _init(): Promise<void> {
        this._engine = new Engine(this._canvas, true);
        this._scene = new Scene(this._engine);

        //**for development: make inspector visible/invisible
        window.addEventListener("keydown", (ev) => {
            //Shift+Ctrl+Alt+I
            if (ev.shiftKey && ev.ctrlKey && ev.altKey && ev.keyCode === 73) {
                if (this._scene.debugLayer.isVisible()) {
                    this._scene.debugLayer.hide();
                } else {
                    this._scene.debugLayer.show();
                }
            }
        });

        //MAIN render loop & state machine
        await this._main();
    }

    private async _main(): Promise<void> {
        await this._goToStart();

        // Register a render loop to repeatedly render the scene
        this._engine.runRenderLoop(() => {
            switch (this._state) {
                case State.START:
                    this._scene.render();
                    break;
                case State.CUTSCENE:
                    this._scene.render();
                    break;
                case State.GAME:
                    //if 240seconds/ 4mins have have passed, go to the lose state
                    if (this._ui.time >= 240 && !this._player.win) {
                        this._goToLose();
                        this._ui.stopTimer();
                    }
                    if (this._ui.quit) {
                        this._goToStart();
                        this._ui.quit = false;
                    }
                    this._scene.render();
                    break;
                case State.LOSE:
                    this._scene.render();
                    break;
                default: break;
            }
        });

        //resize if the screen is resized/rotated
        window.addEventListener('resize', () => {
            this._engine.resize();
        });
    }

    //set up the canvas
    private _createCanvas(): HTMLCanvasElement {

        //Commented out for development
        document.documentElement.style["overflow"] = "hidden";
        document.documentElement.style.overflow = "hidden";
        document.documentElement.style.width = "100%";
        document.documentElement.style.height = "100%";
        document.documentElement.style.margin = "0";
        document.documentElement.style.padding = "0";
        document.body.style.overflow = "hidden";
        document.body.style.width = "100%";
        document.body.style.height = "100%";
        document.body.style.margin = "0";
        document.body.style.padding = "0";

        //create the canvas html element and attach it to the webpage
        this._canvas = document.createElement("canvas");
        this._canvas.style.width = "100%";
        this._canvas.style.height = "100%";
        this._canvas.id = "gameCanvas";
        document.body.appendChild(this._canvas);

        return this._canvas;
    }
    
    // goToStart
    private async _goToStart() {
        // 加载动画
        this._engine.displayLoadingUI(); 

        //--SCENE SETUP--
        //dont detect any inputs from this ui while the game is loading
        this._scene.detachControl();
        let scene = new Scene(this._engine);
        scene.clearColor = new Color4(0, 0, 0, 1);
        //creates and positions a free camera
        let camera = new FreeCamera("camera1", new Vector3(0, 0, 0), scene);
        camera.setTarget(Vector3.Zero()); //targets the camera to scene origin

        //--SOUNDS--
        const start = new Sound("startSong", "./public/sounds/copycat(revised).mp3", scene, function () {
        }, {
            volume: 0.25,
            loop: true,
            autoplay: true
        });
        const sfx = new Sound("selection", "./public/sounds/vgmenuselect.wav", scene, function () {
        });

        //--GUI--
        const guiMenu = AdvancedDynamicTexture.CreateFullscreenUI("UI");
        guiMenu.idealHeight = 720;

        //background image
        const imageRect = new Rectangle("titleContainer");
        imageRect.width = 0.8;
        imageRect.thickness = 0;
        guiMenu.addControl(imageRect);

        const startbg = new Image("startbg", "public/sprites/start.jpeg");
        imageRect.addControl(startbg);

        const title = new TextBlock("title", "SUMMER'S FESTIVAL");
        title.resizeToFit = true;
        title.fontFamily = "Ceviche One";
        title.fontSize = "64px";
        title.color = "white";
        title.resizeToFit = true;
        title.top = "14px";
        title.width = 0.8;
        title.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
        imageRect.addControl(title);

        const startBtn = Button.CreateSimpleButton("start", "PLAY");
        startBtn.fontFamily = "Viga";
        startBtn.width = 0.2
        startBtn.height = "40px";
        startBtn.color = "white";
        startBtn.top = "-20px";
        startBtn.thickness = 0;
        startBtn.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
        imageRect.addControl(startBtn);

        //set up transition effect : modified version of https://www.babylonjs-playground.com/#2FGYE8#0
        Effect.RegisterShader(
            'fade',
            `
             precision highp float;
             varying vec2 vUV;
             uniform sampler2D textureSampler;
             uniform float fadeLevel;
             void main(void) {
                vec4 baseColor = texture2D(textureSampler, vUV) * fadeLevel;
                baseColor.a = 1.0;
                gl_FragColor = baseColor;
             }
            `
        );

        let fadeLevel = 1.0;
        this._transition = false;
        scene.registerBeforeRender(() => {
            if (this._transition) {
                fadeLevel -= .05;
                if(fadeLevel <= 0){
                    this._goToGame()
                    // this._goToCutScene();
                    this._transition = false;
                }
            }
        })

        // PLAY 按钮绑定函数
        startBtn.onPointerDownObservable.add(() => {
            //fade screen
            const postProcess = new PostProcess("Fade", "fade", ["fadeLevel"], null, 1.0, camera);
            postProcess.onApply = (effect) => {
                effect.setFloat("fadeLevel", fadeLevel);
            };
            this._transition = true;
            //sounds
            sfx.play();

            scene.detachControl(); //observables disabled
        });

        let isMobile = false;
        //--MOBILE--
        if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
            isMobile = true;
            //popup for mobile to rotate screen
            const rect1 = new Rectangle();
            rect1.height = 0.2;
            rect1.width = 0.3;
            rect1.verticalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
            rect1.horizontalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
            rect1.background = "white";
            rect1.alpha = 0.8;
            guiMenu.addControl(rect1);

            const rect = new Rectangle();
            rect.height = 0.2;
            rect.width = 0.3;
            rect.verticalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
            rect.horizontalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
            rect.color = "whites";
            guiMenu.addControl(rect);

            const stackPanel = new StackPanel();
            stackPanel.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
            rect.addControl(stackPanel);

            //image
            const image = new Image("rotate", "./public/sprites/rotate.png")
            image.width = 0.4;
            image.height = 0.6;
            image.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
            rect.addControl(image);

            //alert message
            const alert = new TextBlock("alert", "For the best experience, please rotate your device");
            alert.fontSize = "16px";
            alert.fontFamily = "Viga";
            alert.color = "black";
            alert.resizeToFit = true;
            alert.textWrapping = true;
            stackPanel.addControl(alert);

            const closealert = Button.CreateSimpleButton("close", "X");
            closealert.height = "24px";
            closealert.width = "24px";
            closealert.color = "black";
            stackPanel.addControl(closealert);

            //remove control of the play button until the user closes the notification(allowing for fullscreen mode)
            startBtn.isHitTestVisible = false;

            closealert.onPointerUpObservable.add(() => {
                guiMenu.removeControl(rect);
                guiMenu.removeControl(rect1);

                startBtn.isHitTestVisible = true;
                this._engine.enterFullscreen(true);
            })
        }

        //--SCENE FINISHED LOADING--
        await scene.whenReadyAsync();
        this._engine.hideLoadingUI(); //when the scene is ready, hide loading
        //lastly set the current state to the start state and set the scene to the start scene
        this._scene.dispose();
        this._scene = scene;
        this._state = State.START;
    }

    private async _setUpGame() { //async
        //--CREATE SCENE--
        let scene = new Scene(this._engine);
        this._gamescene = scene;

        //--SOUNDS--
        this._loadSounds(scene);

        //--CREATE ENVIRONMENT--
        const environment = new Environment(scene);
        this._environment = environment;
        //Load environment and character assets
        await this._environment.load(); //environment
        await this._loadCharacterAssets(scene); //character
    }

    //loading sounds for the game scene
    private _loadSounds(scene: Scene): void {

        this.game = new Sound("gameSong", "./public/sounds/Christmassynths.wav", scene, function () {
        }, {
            loop:true,
            volume: 0.1
        });

        this.end = new Sound("endSong", "./public/sounds/copycat(revised).mp3", scene, function () {
        }, {
            volume: 0.25
        });
    }

    //goToGame
    private async _goToGame(): Promise<void> {

        this._engine.displayLoadingUI()
        await this._setUpGame()
        this._engine.hideLoadingUI()
        
        //--SETUP SCENE--
        this._scene.detachControl();
        let scene = this._gamescene;

        //--GUI--
        const ui = new Hud(scene);
        this._ui = ui;
        //dont detect any inputs from this ui while the game is loading
        scene.detachControl();

        //IBL (image based lighting) - to give scene an ambient light
        const envHdri = CubeTexture.CreateFromPrefilteredData("public/textures/envtext.env", scene);
        envHdri.name = "env";
        envHdri.gammaSpace = false;
        scene.environmentTexture = envHdri;
        scene.environmentIntensity = 0.04;

        //--INPUT--
        this._input = new PlayerInput(scene, this._ui); //detect keyboard/mobile inputs

        //Initializes the game's loop
        await this._initializeGameAsync(scene); //handles scene related updates & setting up meshes in scene

        //--WHEN SCENE FINISHED LOADING--
        await scene.whenReadyAsync();

        //Actions to complete once the game loop is setup
        scene.getMeshByName("outer").position = scene.getTransformNodeByName("startPosition").getAbsolutePosition(); //move the player to the start position
        //set up the game timer and sparkler timer -- linked to the ui
        this._ui.startTimer();
        this._ui.startSparklerTimer(this._player.sparkler);
        
        //get rid of start scene, switch to gamescene and change states
        this._scene.dispose();
        this._state = State.GAME;
        this._scene = scene;
        this._engine.hideLoadingUI();
        //the game is ready, attach control back
        this._scene.attachControl();

        //--SOUNDS--
        this.game.play(); // play the gamesong
    }

    private _showWin(): void {

        //stop game sound and play end song
        this.game.dispose();
        this.end.play();
        this._player.onRun.clear();

        const winUI = AdvancedDynamicTexture.CreateFullscreenUI("UI");
        winUI.idealHeight = 720;

        const rect = new Rectangle();
        rect.thickness = 0;
        rect.background = "black";
        rect.alpha = 0.4;
        rect.width = 0.4;
        winUI.addControl(rect);

        const stackPanel = new StackPanel("credits");
        stackPanel.width = 0.4;
        stackPanel.fontFamily = "Viga";
        stackPanel.fontSize = "16px";
        stackPanel.color = "white";
        winUI.addControl(stackPanel);

        const wincreds = new TextBlock("special");
        wincreds.resizeToFit = true;
        wincreds.color = "white";
        wincreds.text = "Special thanks to the Babylon Team!";
        wincreds.textWrapping = true;
        wincreds.height = "24px";
        wincreds.width = "100%";
        wincreds.fontFamily = "Viga";
        stackPanel.addControl(wincreds);

        //Credits for music & SFX
        const music = new TextBlock("music", "Music");
        music.fontSize = 22;
        music.resizeToFit = true;
        music.textWrapping = true;
        
        const source = new TextBlock("sources", "Sources: freesound.org, opengameart.org, and itch.io")
        source.textWrapping = true;
        source.resizeToFit = true;

        const jumpCred = new TextBlock("jumpCred", "jump2 by LloydEvans09 - freesound.org");
        jumpCred.textWrapping = true;
        jumpCred.resizeToFit = true;

        const walkCred = new TextBlock("walkCred", "Concrete 2 by MayaSama @mayasama.itch.io / ig: @mayaragandra");
        walkCred.textWrapping = true;
        walkCred.resizeToFit = true;

        const gameCred = new TextBlock("gameSong", "Christmas synths by 3xBlast - opengameart.org"); 
        gameCred.textWrapping = true;
        gameCred.resizeToFit = true;

        const pauseCred = new TextBlock("pauseSong", "Music by Matthew Pablo / www.matthewpablo.com - opengameart.org");
        pauseCred.textWrapping = true;
        pauseCred.resizeToFit = true;

        const endCred = new TextBlock("startendSong", "copycat by syncopika - opengameart.org");
        endCred.textWrapping = true;
        endCred.resizeToFit = true;

        const loseCred = new TextBlock("loseSong", "Eye of the Storm by Joth - opengameart.org");
        loseCred.textWrapping = true;
        loseCred.resizeToFit = true;

        const fireworksSfx = new TextBlock("fireworks", "rubberduck - opengameart.org")
        fireworksSfx.textWrapping = true;
        fireworksSfx.resizeToFit = true;

        const dashCred = new TextBlock("dashCred", "Woosh Noise 1 by potentjello - freesound.org");
        dashCred.textWrapping = true;
        dashCred.resizeToFit = true;

        //quit, sparkwarning, reset
        const sfxCred = new TextBlock("sfxCred", "200 Free SFX - https://kronbits.itch.io/freesfx");
        sfxCred.textWrapping = true;
        sfxCred.resizeToFit = true;

        //lighting lantern, sparkreset
        const sfxCred2 = new TextBlock("sfxCred2", "sound pack by wobbleboxx.com - opengameart.org");
        sfxCred2.textWrapping = true;
        sfxCred2.resizeToFit = true;

        const selectionSfxCred = new TextBlock("select", "8bit menu select by Fupi - opengameart.org");
        selectionSfxCred.textWrapping = true;
        selectionSfxCred.resizeToFit = true;

        stackPanel.addControl(music);
        stackPanel.addControl(source);
        stackPanel.addControl(jumpCred);
        stackPanel.addControl(walkCred);
        stackPanel.addControl(gameCred);
        stackPanel.addControl(pauseCred);
        stackPanel.addControl(endCred);
        stackPanel.addControl(loseCred);
        stackPanel.addControl(fireworksSfx);
        stackPanel.addControl(dashCred);
        stackPanel.addControl(sfxCred);
        stackPanel.addControl(sfxCred2);
        stackPanel.addControl(selectionSfxCred);

        const mainMenu = Button.CreateSimpleButton("mainmenu", "RETURN");
        mainMenu.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
        mainMenu.fontFamily = "Viga";
        mainMenu.width = 0.2
        mainMenu.height = "40px";
        mainMenu.color = "white";
        winUI.addControl(mainMenu);

        mainMenu.onPointerDownObservable.add(() => {
            this._ui.transition = true;
            this._ui.quitSfx.play();
        })

    }

    private async _goToLose(): Promise<void> {
        this._engine.displayLoadingUI();

        //--SCENE SETUP--
        this._scene.detachControl();
        let scene = new Scene(this._engine);
        scene.clearColor = new Color4(0, 0, 0, 1);
        let camera = new FreeCamera("camera1", new Vector3(0, 0, 0), scene);
        camera.setTarget(Vector3.Zero());

        //--SOUNDS--
        const start = new Sound("loseSong", "./public/sounds/Eye of the Storm.mp3", scene, function () {
        }, {
            volume: 0.25,
            loop: true,
            autoplay: true
        });
        const sfx = new Sound("selection", "./public/sounds/vgmenuselect.wav", scene, function () {
        });

        //--GUI--
        const guiMenu = AdvancedDynamicTexture.CreateFullscreenUI("UI");
        guiMenu.idealHeight = 720;

        //background image
        const image = new Image("lose", "public/sprites/lose.jpeg");
        image.autoScale = true;
        guiMenu.addControl(image);

        const panel = new StackPanel();
        guiMenu.addControl(panel);

        const text = new TextBlock();
        text.fontSize = 24;
        text.color = "white";
        text.height = "100px";
        text.width = "100%";
        panel.addControl(text);

        text.textHorizontalAlignment = TextBlock.HORIZONTAL_ALIGNMENT_CENTER;
        text.textVerticalAlignment = TextBlock.VERTICAL_ALIGNMENT_CENTER;
        text.text = "There's no fireworks this year";
        const dots = new TextBlock();
        dots.color = "white";
        dots.fontSize = 24;
        dots.height = "100px";
        dots.width = "100%";
        dots.text = "...."

        const mainBtn = Button.CreateSimpleButton("mainmenu", "MAIN MENU");
        mainBtn.width = 0.2;
        mainBtn.height = "40px";
        mainBtn.color = "white";
        panel.addControl(mainBtn);

        //set up transition effect : modified version of https://www.babylonjs-playground.com/#2FGYE8#0
        Effect.RegisterShader("fade",
            "precision highp float;" +
            "varying vec2 vUV;" +
            "uniform sampler2D textureSampler; " +
            "uniform float fadeLevel; " +
            "void main(void){" +
            "vec4 baseColor = texture2D(textureSampler, vUV) * fadeLevel;" +
            "baseColor.a = 1.0;" +
            "gl_FragColor = baseColor;" +
            "}");

        let fadeLevel = 1.0;
        this._transition = false;
        scene.registerBeforeRender(() => {
            if (this._transition) {
                fadeLevel -= .05;
                if(fadeLevel <= 0){
                    
                    this._goToStart();
                    this._transition = false;
                }
            }
        })

        //this handles interactions with the start button attached to the scene
        mainBtn.onPointerUpObservable.add(() => {
            //todo: add fade transition & selection sfx
            scene.detachControl();
            guiMenu.dispose();
            
            this._transition = true;
            sfx.play();
            
        });

        //--SCENE FINISHED LOADING--
        await scene.whenReadyAsync();
        this._engine.hideLoadingUI(); //when the scene is ready, hide loading
        //lastly set the current state to the lose state and set the scene to the lose scene
        this._scene.dispose();
        this._scene = scene;
        this._state = State.LOSE;
    }

    //load the character model
    private async _loadCharacterAssets(scene): Promise<any> {

        async function loadCharacter() {
            //collision mesh
            const outer = MeshBuilder.CreateBox("outer", { width: 2, depth: 1, height: 3 }, scene);
            outer.isVisible = false;
            outer.isPickable = false;
            outer.checkCollisions = true;

            //move origin of box collider to the bottom of the mesh (to match player mesh)
            outer.bakeTransformIntoVertices(Matrix.Translation(0, 1.5, 0))
            //for collisions
            outer.ellipsoid = new Vector3(1, 1.5, 1);
            outer.ellipsoidOffset = new Vector3(0, 1.5, 0);

            outer.rotationQuaternion = new Quaternion(0, 1, 0, 0); // rotate the player mesh 180 since we want to see the back of the player
            
            //--IMPORTING MESH--
            return SceneLoader.ImportMeshAsync(null, "./public/models/", "player.glb", scene).then((result) =>{
                const root = result.meshes[0];
                //body is our actual player mesh
                const body = root;
                body.parent = outer;
                body.isPickable = false;
                body.getChildMeshes().forEach(m => {
                    m.isPickable = false;
                })
                
                //return the mesh and animations
                return {
                    mesh: outer as Mesh,
                    animationGroups: result.animationGroups
                }
            });
        }

        return loadCharacter().then(assets => {
            this.assets = assets;
        });
    }

    //init game
    private async _initializeGameAsync(scene): Promise<void> {

        scene.ambientColor = new Color3(0.34509803921568627, 0.5568627450980392, 0.8352941176470589);
        scene.clearColor = new Color4(0.01568627450980392, 0.01568627450980392, 0.20392156862745098);

        const light = new PointLight("sparklight", new Vector3(0, 0, 0), scene);
        light.diffuse = new Color3(0.08627450980392157, 0.10980392156862745, 0.15294117647058825);
        light.intensity = 35;
        light.radius = 1;

        const shadowGenerator = new ShadowGenerator(1024, light);
        shadowGenerator.darkness = 0.4;

        //Create the player
        this._player = new Player(this.assets, scene, shadowGenerator, this._input);

        const camera = this._player.activatePlayerCamera();

        //set up lantern collision checks
        this._environment.checkLanterns(this._player);

        //--Transition post process--
        scene.registerBeforeRender(() => {
            if (this._ui.transition) {
                this._ui.fadeLevel -= .05;

                //once the fade transition has complete, switch scenes
                if(this._ui.fadeLevel <= 0) {
                    this._ui.quit = true;
                    this._ui.transition = false;
                }
            }
        })

        //--GAME LOOP--
        scene.onBeforeRenderObservable.add(() => {
            //reset the sparkler timer
            if (this._player.sparkReset) {
                this._ui.startSparklerTimer(this._player.sparkler);
                this._player.sparkReset = false;

                this._ui.updateLanternCount(this._player.lanternsLit);
            }
            //stop the sparkler timer after 20 seconds
            else if (this._ui.stopSpark && this._player.sparkLit) {
                this._ui.stopSparklerTimer(this._player.sparkler);
                this._player.sparkLit = false;
            }

            //if you've reached the destination and lit all the lanterns
            if (this._player.win && this._player.lanternsLit == 22) {
                this._ui.gamePaused = true; //stop the timer so that fireworks can play and player cant move around
                //dont allow pause menu interaction
                this._ui.pauseBtn.isHitTestVisible = false;

                let i = 10; //10 seconds
                window.setInterval(() => {
                    i--;
                    if (i == 0) {
                        this._showWin();
                    }
                }, 1000);

                this._environment._startFireworks = true;
                this._player.win = false;
            }

            if (!this._ui.gamePaused) {
                this._ui.updateHud();
            }
            //if the player has attempted all tutorial moves, move on to the hint IF they haven't already lit the next lantern
            if(this._player.tutorial_move && this._player.tutorial_jump && this._player.tutorial_dash && (this._ui.tutorial.isVisible || this._ui.hint.isVisible)){
                this._ui.tutorial.isVisible = false;
                if(!this._environment._lanternObjs[1].isLit){ // if the first lantern hasn't been lit, then give hint as to which direction to go
                    this._ui.hint.isVisible = true;
                } else {
                    this._ui.hint.isVisible = false;
                }
            }
        })
        //glow layer
        const gl = new GlowLayer("glow", scene);
        gl.intensity = 0.4;
        this._environment._lanternObjs.forEach(lantern => {
            gl.addIncludedOnlyMesh(lantern.mesh);
        });
        //webpack served from public       
    }
}
new App();