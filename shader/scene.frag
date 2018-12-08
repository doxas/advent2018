/* ----------------------------------------------------------------------------
 * paste shader
 * ---------------------------------------------------------------------------- */
precision mediump float;
uniform sampler2D graphTexture;

varying vec2 vTexCoord;

void main(){
    // graph
    gl_FragColor = texture2D(graphTexture, vTexCoord);
}
