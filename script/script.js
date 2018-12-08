
(() => {
    // variable ===============================================================
    let gl, run, mat4, count, nowTime, framebuffer;
    let canvas, canvasWidth, canvasHeight;

    // shader
    let scenePrg, graphPrg;

    // constant
    const RESOLUTION = 512;
    const SPLIT = 4;

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
        let slider = new gl3.Gui.Slider('test', 50, 0, 100, 1);
        slider.add('input', (eve, self) => {console.log(self.getValue());});
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
            ['mMatrix', 'mvpMatrix', 'texture'],
            ['matrix4fv', 'matrix4fv', '1i'],
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
        let nowTime = 0;
        let cameraPosition = [0.0, 0.0, 5.0];
        let centerPoint    = [0.0, 0.0, 0.0];
        let upDirection    = [0.0, 1.0, 0.0];

        // rendering
        render();
        function render(){
            nowTime = Date.now() - beginTime;
            nowTime /= 1000;

            // animation
            // if(run){requestAnimationFrame(render);}

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

            // render to framebuffer ==========================================
            // gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer.framebuffer);
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

            /*
            // program
            scenePrg.useProgram();
            scenePrg.setAttribute(icosaVBO, icosaIBO);
            // scenePrg.setAttribute(torusVBO, torusIBO);

            // render to canvas
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
            gl3.sceneView(0, 0, canvasWidth, canvasHeight);
            gl3.sceneClear([0.1, 0.1, 0.1, 1.0], 1.0);

            // model and draw
            mat4.identity(mMatrix);
            mat4.translate(mMatrix, [0.0, 0.0, Math.sin(nowTime) * 0.25], mMatrix);
            mat4.rotate(mMatrix, nowTime, [1.0, 1.0, 1.0], mMatrix);
            mat4.multiply(vpMatrix, mMatrix, mvpMatrix);
            mat4.inverse(mMatrix, invMatrix);
            mat4.transpose(invMatrix, normalMatrix);
            scenePrg.pushShader([
                mMatrix,
                mvpMatrix,
                normalMatrix,
                cameraPosition,
                lightPosition,
                ambientColor,
                targetTexture
            ]);
            gl3.drawElements(gl.TRIANGLES, icosaData.index.length);
            */

            // final
            gl.flush();
        }
    }
})();

