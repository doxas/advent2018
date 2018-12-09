
(() => {
    // variable ===============================================================
    let gl, run, mat4, qtn, camera, nowTime, framebuffer;
    let canvas, canvasWidth, canvasHeight;
    let speed = Math.PI * 0.5;

    // shader
    let scenePrg, graphPrg;

    // constant
    const RESOLUTION = 2048;
    const SPLIT = 4;
    const CYLINDERS = SPLIT * SPLIT;
    const CYLINDER_SCALE = 2.0;

    // onload =================================================================
    window.addEventListener('load', () => {
        gl3.init(
            document.getElementById('canvas'), // or gl3.init('canvas')
            null,
            {
                webgl2Mode: true,
                consoleMessage: true
            }
        );
        if(!gl3.ready){
            console.log('initialize error');
            return;
        }
        run           = true;
        canvas        = gl3.canvas;
        gl            = gl3.gl;
        mat4          = gl3.Math.Mat4;
        qtn           = gl3.Math.Qtn;
        canvasWidth   = window.innerWidth;
        canvasHeight  = window.innerHeight;
        canvas.width  = canvasWidth;
        canvas.height = canvasHeight;
        camera        = new InteractionCamera();
        camera.update();
        canvas.addEventListener('mousedown', camera.startEvent, false);
        canvas.addEventListener('mousemove', camera.moveEvent, false);
        canvas.addEventListener('mouseup', camera.endEvent, false);
        canvas.addEventListener('wheel', camera.wheelEvent, false);

        // event attach
        window.addEventListener('keydown', (eve) => {
            if(eve.keyCode === 27){run = false;}
        }, false);
        window.addEventListener('resize', () => {
            canvasWidth = window.innerWidth;
            canvasHeight = window.innerHeight;
            canvas.width = canvasWidth;
            canvas.height = canvasHeight;
        }, false);

        // element
        let wrapper = new gl3.Gui.Wrapper();
        document.body.appendChild(wrapper.getElement());
        let slider = new gl3.Gui.Slider('test', 5, 0, 100, 1);
        slider.add('input', (eve, self) => {
            speed = self.getValue() * Math.PI * 0.1;
        });
        wrapper.append(slider.getElement());

        shaderLoader();
    }, false);

    function shaderLoader(){
        // scene program
        scenePrg = gl3.createProgramFromFile(
            'shader/scene.vert',
            'shader/scene.frag',
            ['position', 'texCoord'],
            [3, 2],
            ['mvpMatrix', 'texture'],
            ['matrix4fv', '1i'],
            shaderLoadCheck
        );
        // graph texture program
        graphPrg = gl3.createProgramFromFile(
            'shader/graph.vert',
            'shader/graph.frag',
            ['position', 'texCoord'],
            [3, 2],
            ['resolution', 'time'],
            ['2fv', '1f'],
            shaderLoadCheck
        );
        // load check
        function shaderLoadCheck(){
            if(
                scenePrg.prg != null &&
                graphPrg.prg != null &&
                true
            ){init();}
        }
    }

    function init(){
        // plane
        let planePosition = [
            -1.0,  1.0,  0.0,
             1.0,  1.0,  0.0,
            -1.0, -1.0,  0.0,
             1.0, -1.0,  0.0
        ];
        let planeTexCoord = [
            0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 1.0, 1.0
        ];
        let planeIndex = [
            0, 2, 1,
            1, 2, 3
        ];
        let planeVBO = [
            gl3.createVbo(planePosition),
            gl3.createVbo(planeTexCoord)
        ];
        let planeIBO = gl3.createIbo(planeIndex);

        // plane cylinder
        let cylinderPosition = [];
        let cylinderTexCoord = [];
        let cylinderIndex = [];
        {
            let rad = Math.PI * 2.0 / CYLINDERS;
            let halfRad = rad / 2.0;
            let top = Math.sin(halfRad) * CYLINDER_SCALE;
            let bottom = -top;
            let index = 0;
            for(let i = 0; i < SPLIT; ++i){
                for(let j = 0; j < SPLIT; ++j){
                    let k = i * SPLIT + j;
                    let c0 = Math.cos(-halfRad + k * rad) * CYLINDER_SCALE;
                    let c1 = Math.cos(-halfRad + (k + 1) * rad) * CYLINDER_SCALE;
                    let s0 = Math.sin(-halfRad + k * rad) * CYLINDER_SCALE;
                    let s1 = Math.sin(-halfRad + (k + 1) * rad) * CYLINDER_SCALE;
                    cylinderPosition.push(
                        c0, top, s0,
                        c1, top, s1,
                        c0, bottom, s0,
                        c1, bottom, s1
                    );
                    let u0 = i * (1.0 / SPLIT);
                    let u1 = (i + 1) * (1.0 / SPLIT);
                    let v0 = j * (1.0 / SPLIT);
                    let v1 = (j + 1) * (1.0 / SPLIT);
                    cylinderTexCoord.push(
                        u0, v0, u1, v0, u0, v1, u1, v1
                    );
                    cylinderIndex.push(
                        index, index + 1, index + 2,
                        index + 2, index + 1, index + 3
                    );
                    index += 4;
                }
            }
        }
        let cylinderVBO = [
            gl3.createVbo(cylinderPosition),
            gl3.createVbo(cylinderTexCoord)
        ];
        let cylinderIBO = gl3.createIbo(cylinderIndex);

        // matrix
        let mMatrix      = mat4.identity(mat4.create());
        let vMatrix      = mat4.identity(mat4.create());
        let pMatrix      = mat4.identity(mat4.create());
        let vpMatrix     = mat4.identity(mat4.create());
        let mvpMatrix    = mat4.identity(mat4.create());
        let qtnMatrix    = mat4.identity(mat4.create());

        // framebuffer
        framebuffer = gl3.createFramebuffer(RESOLUTION, RESOLUTION, 0);

        // texture
        gl3.textures.map((v, i) => {
            if(v != null && v.texture != null){
                gl.activeTexture(gl.TEXTURE0 + i);
                gl.bindTexture(gl.TEXTURE_2D, v.texture);
            }
        });

        // gl flags
        gl.enable(gl.DEPTH_TEST);
        gl.disable(gl.CULL_FACE);

        // variables
        let beginTime = Date.now();
        let nowTime = 0.0;
        let cameraPosition = [0.0, 0.0, 4.0];
        let centerPoint    = [0.0, 0.0, 0.0];
        let upDirection    = [0.0, 1.0, 0.0];

        // render to framebuffer ==========================================
        gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer.framebuffer);
        gl3.sceneClear([0.1, 0.1, 0.1, 1.0], 1.0);
        graphPrg.useProgram();
        graphPrg.setAttribute(planeVBO, planeIBO);

        let size = RESOLUTION / SPLIT;
        let radTime = Math.PI / (SPLIT * SPLIT);
        for(let i = 0; i < SPLIT; ++i){
            for(let j = 0; j < SPLIT; ++j){
                let k = i * SPLIT + j;
                gl3.sceneView(size * i, size * j, size, size);
                graphPrg.pushShader([[size, size], radTime * k]);
                gl3.drawElements(gl.TRIANGLES, planeIndex.length);
            }
        }

        // rendering
        render();
        function render(){
            let time = Date.now() - beginTime;
            nowTime = time / 1000;

            // animation
            if(run){requestAnimationFrame(render);}

            // canvas
            canvasWidth   = window.innerWidth;
            canvasHeight  = window.innerHeight;
            canvas.width  = canvasWidth;
            canvas.height = canvasHeight;

            // view x proj
            camera.update();
            mat4.vpFromCameraProperty(
                cameraPosition,
                centerPoint,
                upDirection,
                60 * camera.scale,
                canvasWidth / canvasHeight,
                0.1,
                10.0,
                vMatrix, pMatrix, vpMatrix
            );
            mat4.identity(qtnMatrix);
            qtn.toMatIV(camera.qtn, qtnMatrix);
            mat4.multiply(vpMatrix, qtnMatrix, vpMatrix);

            // program
            scenePrg.useProgram();
            scenePrg.setAttribute(cylinderVBO, cylinderIBO);

            // render to canvas
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
            gl3.sceneView(0, 0, canvasWidth, canvasHeight);
            gl3.sceneClear([0.1, 0.1, 0.1, 1.0], 1.0);

            // model and draw
            let sp = (Math.PI * 2.0) / CYLINDERS;
            mat4.identity(mMatrix);
            mat4.rotate(mMatrix, nowTime * speed, [0.0, 0.1, 0.0], mMatrix);
            mat4.multiply(vpMatrix, mMatrix, mvpMatrix);
            scenePrg.pushShader([mvpMatrix, 0]);
            gl3.drawElements(gl.TRIANGLES, cylinderIndex.length);

            // final
            gl.flush();
        }
    }

    class InteractionCamera {
        /**
         * @constructor
         */
        constructor(){
            this.qtn               = qtn.identity(qtn.create());
            this.dragging          = false;
            this.prevMouse         = [0, 0];
            this.rotationScale     = Math.min(window.innerWidth, window.innerHeight);
            this.rotation          = 0.0;
            this.rotateAxis        = [0.0, 0.0, 0.0];
            this.rotatePower       = 1.5;
            this.rotateAttenuation = 0.9;
            this.scale             = 1.0;
            this.scalePower        = 0.0;
            this.scaleAttenuation  = 0.8;
            this.scaleMin          = 0.75;
            this.scaleMax          = 1.25;
            this.startEvent        = this.startEvent.bind(this);
            this.moveEvent         = this.moveEvent.bind(this);
            this.endEvent          = this.endEvent.bind(this);
            this.wheelEvent        = this.wheelEvent.bind(this);
        }
        /**
         * mouse down event
         * @param {Event} eve - event object
         */
        startEvent(eve){
            this.dragging = true;
            this.prevMouse = [eve.clientX, eve.clientY];
        }
        /**
         * mouse move event
         * @param {Event} eve - event object
         */
        moveEvent(eve){
            if(this.dragging !== true){return;}
            let x = this.prevMouse[0] - eve.clientX;
            let y = this.prevMouse[1] - eve.clientY;
            this.rotation = Math.sqrt(x * x + y * y) / this.rotationScale * this.rotatePower;
            this.rotateAxis[0] = y;
            this.rotateAxis[1] = 0;
            this.prevMouse = [eve.clientX, eve.clientY];
        }
        /**
         * mouse up event
         */
        endEvent(){
            this.dragging = false;
        }
        /**
         * wheel event
         * @param {Event} eve - event object
         */
        wheelEvent(eve){
            let w = eve.wheelDelta;
            if(w > 0){
                this.scalePower = -0.02;
            }else if(w < 0){
                this.scalePower =  0.02;
            }
        }
        /**
         * quaternion update
         */
        update(){
            this.scalePower *= this.scaleAttenuation;
            this.scale = Math.max(this.scaleMin, Math.min(this.scaleMax, this.scale + this.scalePower));
            if(this.rotation === 0.0){return;}
            this.rotation *= this.rotateAttenuation;
            let q = qtn.identity(qtn.create());
            qtn.rotate(this.rotation, this.rotateAxis, q);
            qtn.multiply(this.qtn, q, this.qtn);
        }
    }
})();

