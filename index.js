
const
    Engine = Matter.Engine,
    Events = Matter.Events,
    Render = Matter.Render,
    Runner = Matter.Runner,
    Composite = Matter.Composite,
    Composites = Matter.Composites,
    Common = Matter.Common,
    MouseConstraint = Matter.MouseConstraint,
    Mouse = Matter.Mouse,
    World = Matter.World,
    Bodies = Matter.Bodies;

const rad = deg => deg * (Math.PI / 180);
const randomRange = (begin, end) => begin + Math.random() * (end - begin);

class CssUtils {

    static readCssVar(varName) {
        varName = varName.startsWith("--") ? varName : "--" + varName;
        return window.getComputedStyle(document.documentElement).getPropertyValue(varName);
    }

    static readCssVarAsNumber(varName) {
        return parseInt(CssUtils.readCssVar(varName), 10);
    }

    static readCalculatedCssVarAsNumber(varName) {
        let div = document.getElementById("readCalculatedCssVarAsNumber");
        if (!div) {
            div = document.createElement("div");
            div.setAttribute("id", "readCalculatedCssVarAsNumber");
            div.setAttribute("position", "absolute");  // detach it from the flow so it doesn't break anything
            document.body.appendChild(div);  // won't work unless you actually append it to the DOM
        }
        div.style.strokeWidth = readCssVar(varName);  // apply it to some innocent property
        return parseInt(getComputedStyle(div).getPropertyValue("stroke-width"), 10);  // read it back!
    }

    static writeCssVar(varName, value) {
        varName = varName.startsWith("--") ? varName : "--" + varName;
        document.documentElement.style.setProperty(varName, value);
    }
}

class Galton {

    constructor () {
        this.canvasWidth = CssUtils.readCssVarAsNumber("app-width");
        this.canvasHeight = CssUtils.readCssVarAsNumber("app-height");

        this.yellow = CssUtils.readCssVar("yellow");
        this.lightPurple = CssUtils.readCssVar("light-purple");
        this.green = CssUtils.readCssVar("green");

        this.spacing = CssUtils.readCssVarAsNumber("app-spacing");
        this.pegsHorizontalSpacing = 2 * this.spacing;
        this.pegsVerticalSpacing = this.spacing;
        this.bottomPegRowSize = CssUtils.readCssVarAsNumber("app-bottom-peg-row-size");
        this.pegPyramidHeight = (this.bottomPegRowSize - 1) * this.pegsVerticalSpacing;
        this.topPegY = CssUtils.readCssVarAsNumber("app-top-peg-y");
        this.beadStartPositionRangeBegin = CssUtils.readCssVarAsNumber("app-bead-start-position-range-begin");
        this.beadStartPositionRangeEnd = CssUtils.readCssVarAsNumber("app-bead-start-position-range-end");
        this.beadSize = CssUtils.readCssVarAsNumber("app-bead-size");
        this.pegSize = CssUtils.readCssVarAsNumber("app-peg-size");

        this.tubeHeight = this.pegPyramidHeight;  // just make it the same height as the pyramid
        this.halfTubeHeight = this.tubeHeight / 2;
        this.tubesY = this.topPegY + this.pegPyramidHeight + this.spacing + this.halfTubeHeight;
        this.numberOfTubeWalls = this.bottomPegRowSize * 2 + 1;
        this.tubesHorizontalSpacing = this.pegsHorizontalSpacing / 2;
        this.tubesWidth = (this.numberOfTubeWalls - 1) * this.tubesHorizontalSpacing;
        this.halfTubesWidth = this.tubesWidth / 2;

        this.numberOfSensors = this.numberOfTubeWalls - 1;
        this.sensorsWidth = (this.numberOfSensors - 1) * this.tubesHorizontalSpacing;
        this.halfSensorsWidth = this.sensorsWidth / 2;
        this.sensorsY = this.tubesY + this.halfTubeHeight;
        this.sensorSize = .8 * this.tubesHorizontalSpacing;

        this.sensorIndexBySensor = new Map();
        this.sensorCounters = Array.from(Array(this.numberOfSensors), () => 0);
        this.topCounter = 0;

        this.distributionBarsManualBaseAdjust = -4;
        this.distributionBarsManualDeltaAdjust = -.9;
        this.distributionBarsX = this.canvasWidth / 2 - this.halfSensorsWidth + this.distributionBarsManualBaseAdjust;
        this.distributionBarsY = this.tubesY - this.halfTubeHeight;

        this.backgroundCanvas = document.getElementById("background-canvas");
        this.backgroundCanvas.width = this.canvasWidth;
        this.backgroundCanvas.height = this.canvasHeight;
        /** @type {CanvasRenderingContext2D} */
        this.backgroundContext = this.backgroundCanvas.getContext("2d");

        this.matterCanvas = document.getElementById("matter-canvas");

        this.engine = Engine.create();
        this.world = this.engine.world;
        this.render = Render.create({
            engine: this.engine,
            canvas: this.matterCanvas,
            options: {
                width: this.canvasWidth,
                height: this.canvasHeight,
                showAngleIndicator: false,
                wireframes: false,
                background: "transparent",
            }
        });

        Render.run(this.render);

        const runner = Runner.create();
        Runner.run(runner, this.engine);

        this.makePegsPyramid();
        this.makeBead();
        // this.makeFunnel();
        this.makeTubes();
        this.redrawDistributionsBars();

        Render.lookAt(this.render, Composite.allBodies(this.world));

        Events.on(this.engine, "collisionEnd", this.onCollisionEnd.bind(this));

        setInterval(this.makeBead.bind(this), CssUtils.readCssVarAsNumber("app-bead-period-in-millis"));
        setInterval(this.removeFallenBeads.bind(this), 5000);
    }

    onCollisionEnd (event) {
        let hadChange = false;

        for (const pair of event.pairs) {

            const index = this.sensorIndexBySensor.get(pair.bodyA) || this.sensorIndexBySensor.get(pair.bodyB);
            if (index) {
                this.sensorCounters[index]++;
                if (this.topCounter < this.sensorCounters[index]) {
                    this.topCounter = this.sensorCounters[index];
                }
                hadChange = true;
            }
        }

        if (hadChange) {
            this.redrawDistributionsBars();
        }
    }

    /**
     * Remove beads that have fallen off screen
     */
    removeFallenBeads() {
        const bodiesToRemove = [];
        for (const body of this.world.bodies) {
            if (body.position.y > this.canvasHeight) {
                bodiesToRemove.push(body);
            }
        }
        bodiesToRemove.forEach(body => Composite.remove(this.world, body));
    }

    makeBead() {
        if (document.hidden) {
            // if the tab doesn't have focus, it's likely the simulation is paused; do not insert new objects otherwise
            // the simulation may break if too many accumulate at the same spot
            return;
        }
        const x = randomRange(this.beadStartPositionRangeBegin, this.beadStartPositionRangeEnd);
        World.add(this.world, Bodies.circle(x, 0, this.beadSize, {
            friction: 1e-5, restitution: 0.001, density: 1e-3,
            render: { fillStyle: this.yellow },
        }));
    }

    makeFunnel() {
        World.add(this.world, [
            Bodies.rectangle(55, 150, 200, 10, { isStatic: true, angle: rad(45) }),
            Bodies.rectangle(220, 150, 200, 10, { isStatic: true, angle: rad(135) }),
            Bodies.rectangle(148, 240, 40, 10, { isStatic: true, angle: rad(90) }),
            Bodies.rectangle(125, 240, 40, 10, { isStatic: true, angle: rad(90) }),
            // Bodies.rectangle(340, 580, 700, 20, { isStatic: true, angle: Math.PI * 0.04 })
        ]);
    }

    makePegsPyramid() {
        for (let y = 0; y < this.bottomPegRowSize; y++) {
            const rowWidth = y * this.pegsHorizontalSpacing;
            const shiftToCentralize = rowWidth / 2;

            for (let x = 0; x <= y; x++) {
                World.add(this.world, Bodies.circle(
                    x * this.pegsHorizontalSpacing - shiftToCentralize,
                    this.topPegY + y * this.pegsVerticalSpacing,
                    this.pegSize, {
                        isStatic: true,
                        render: { fillStyle: this.lightPurple },
                    })
                );
            }
        }
    }

    makeTubes() {
        // tubes walls
        for (let x = 0; x < this.numberOfTubeWalls; x++) {
            World.add(this.world, Bodies.rectangle(
                x * this.tubesHorizontalSpacing - this.halfTubesWidth,
                this.tubesY, this.tubeHeight, 1, {
                    isStatic: true,
                    angle: rad(90),
                    render: { fillStyle: this.lightPurple },
                })
            );
        }

        // sensors
        for (let i = 0; i < this.numberOfSensors; i++) {
            const sensor = Bodies.rectangle(
                i * this.tubesHorizontalSpacing - this.halfSensorsWidth,
                this.sensorsY - this.sensorSize,
                this.sensorSize, this.sensorSize, {
                    isSensor: true,
                    isStatic: true,
                    render: { fillStyle: "transparent" },
                });

            this.sensorIndexBySensor.set(sensor, i);
            World.add(this.world, sensor);
        }
    }

    redrawDistributionsBars() {
        this.backgroundContext.clearRect(0, 0, this.canvasWidth, this.canvasHeight);

        for (let i = 0; i < this.numberOfSensors; i++) {
            const x = this.distributionBarsX + i * (this.spacing + this.distributionBarsManualDeltaAdjust);
            const height = this.tubeHeight * this.sensorCounters[i] / this.topCounter;
            const y = this.tubeHeight - height;

            this.backgroundContext.fillStyle = this.green;
            this.backgroundContext.fillRect(x, this.distributionBarsY + y, this.sensorSize, height);
        }
    }
}

new Galton();
