
(() => {
    // variable ===============================================================
    let gl, run, mat4, count, nowTime, framebuffer;
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
        canvasWidth   = window.innerWidth;
        canvasHeight  = window.innerHeight;
        canvas.width  = canvasWidth;
        canvas.height = canvasHeight;

        // event attach
        window.addEventListener('keydown', (eve) => {
            if(eve.keyCode === 27){run = false;}
        }, false);
        window.addEventListener('resize', () => {
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
            gl.activeTexture(gl.TEXTURE1);
            gl.bindTexture(gl.TEXTURE_2D, null);
            gl3.deleteFramebuffer(framebuffer);
            canvasWidth = window.innerWidth;
            canvasHeight = window.innerHeight;
            canvas.width = canvasWidth;
            canvas.height = canvasHeight;
            framebuffer = gl3.createFramebuffer(canvasWidth, canvasHeight, 1);
            gl.bindTexture(gl.TEXTURE_2D, framebuffer.texture);
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
            mat4.vpFromCameraProperty(
                cameraPosition,
                centerPoint,
                upDirection,
                60,
                canvasWidth / canvasHeight,
                0.1,
                10.0,
                vMatrix, pMatrix, vpMatrix
            );

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
})();

