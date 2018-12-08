/* ----------------------------------------------------------------------------
 * graph shader
 * ---------------------------------------------------------------------------- */
precision mediump float;
uniform vec2  resolution; // resolution (width, height)
uniform float time;       // time       (1second == 1.0)
varying vec2  vTexCoord;

const vec3 SUN = vec3(0.8, 0.4, 0.1);
const vec3 HORIZON = vec3(0.2, 0.3, 1.0);

void main(){
    vec2 p = vTexCoord * 2.0 - 1.0;
    float t = abs(sin(time)) * 0.5;
    float h = clamp(abs(sin(time)), 0.1, 0.25);
    float i = smoothstep(0.0, 0.25, 0.25 - h) * 0.25;
    vec2 q = vec2(p.x, p.y / (h * 2.0 + 0.5));
    float s = pow(0.25 / abs(length(q - vec2(0.0, t - 0.375 - i))), 5.0);
    float f = abs(0.02 / (p.y + 0.5) + 0.25);
    gl_FragColor = vec4(s * SUN + f * HORIZON, 1.0);
}
