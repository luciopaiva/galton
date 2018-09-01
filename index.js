
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

class Galton {

    constructor () {
        this.canvasWidth = 800;
        this.canvasHeight = 600;

        this.engine = Engine.create();
        this.world = this.engine.world;
        this.render = Render.create({
            element: document.body,
            engine: this.engine,
            options: {
                width: this.canvasWidth,
                height: this.canvasHeight,
                showAngleIndicator: false,
                wireframes: false,
                // background: "transparent",
            }
        });

        Render.run(this.render);

        const runner = Runner.create();
        Runner.run(runner, this.engine);

        this.bottomPinRowSize = 9;
        this.makePins();
        // this.makeBeads();
        this.makeBead();
        // this.makeFunnel();
        this.makeSlots();

        Render.lookAt(this.render, Composite.allBodies(this.world));

        setInterval(this.makeBead.bind(this), 250);
        setInterval(this.removeFallenBeads.bind(this), 5000);
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
            // if the tab doesn't have focus, it's likely the simulation is paused; do not insert new objects otherwise the simulation may break if too many accumulate at the same spot
            return;
        }
        const x = Math.random() * 20 - 10;
        World.add(this.world, Bodies.circle(x, 0, 8, {
            friction: 1e-5, restitution: 0.001, density: 1e-3,
            render: { fillStyle: "#ffc83d" },
        }));
    }

    makeBeads() {
        const stack = Composites.stack(50, 0, 10, 10, 0, 0,
            (x, y) => Bodies.circle(x, y, 8, { friction: 1e-5, restitution: 0.0, density: 1e-3 }));
        World.add(this.world, stack);
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

    makePins() {
        const baseX = 0;
        const baseY = 100;
        const hspacing = 60;
        const vspacing = 30;
        for (let y = 0; y < this.bottomPinRowSize; y++) {
            const width = y * hspacing;
            const shiftToCentralize = width / 2;
            for (let x = 0; x <= y; x++) {
                World.add(this.world, Bodies.circle(
                    baseX - shiftToCentralize + x * hspacing,
                    baseY + y * vspacing,
                    5, {
                        isStatic: true,
                        render: { fillStyle: "#d138d3" },
                    })
                );
            }
        }
    }

    makeSlots() {
        const pinsHeight = (this.bottomPinRowSize - 1) * 30;
        const wallHeight = pinsHeight;
        const baseX = 0;
        const baseY = 100 + pinsHeight + wallHeight / 2 + 30;
        const hspacing = 30;  // must be half of pins hspacing
        const numberOfWalls = this.bottomPinRowSize * 2 + 1;
        const width = (numberOfWalls - 1) * hspacing;
        const shiftLeft = width / 2;

        // walls
        for (let x = 0; x < numberOfWalls; x++) {
            World.add(this.world, Bodies.rectangle(
                baseX - shiftLeft + x * hspacing,
                baseY, wallHeight, 1, {
                    isStatic: true,
                    angle: rad(90),
                    render: { fillStyle: "#f0f0f0" },
                })
            );
        }

        let numberOfSensors = numberOfWalls - 1;
        const sensorsWidth = (numberOfSensors - 1) * hspacing;
        const sensorShiftLeft = sensorsWidth / 2;
        const sensorBaseY = baseY + wallHeight / 2;
        const sensorSize = .8 * hspacing;

        // sensors
        for (let x = 0; x < numberOfSensors; x++) {
            World.add(this.world, Bodies.rectangle(
                baseX - sensorShiftLeft + x * hspacing,
                sensorBaseY - sensorSize, sensorSize, sensorSize, {
                    isSensor: true,
                    isStatic: true,
                    render: { fillStyle: "#590000" },
                })
            );
        }
    }
}

new Galton();

/*

// add bodies
const stack = Composites.stack(20, 20, 20, 20, 0, 0,
    (x, y) => Bodies.circle(x, y, 5, { friction: 0.00001, restitution: 0.5, density: 0.001 }));

World.add(world, stack);



// World.add(world, [
//     Bodies.rectangle(200, 150, 700, 20, { isStatic: true, angle: Math.PI * 0.06 }),
//     Bodies.rectangle(500, 350, 700, 20, { isStatic: true, angle: -Math.PI * 0.06 }),
//     Bodies.rectangle(340, 580, 700, 20, { isStatic: true, angle: Math.PI * 0.04 })
// ]);

// add mouse control
const mouse = Mouse.create(render.canvas),
    mouseConstraint = MouseConstraint.create(engine, {
        mouse: mouse,
        constraint: {
            stiffness: 0.2,
            render: {
                visible: false
            }
        }
    });

World.add(world, mouseConstraint);

// keep the mouse in sync with rendering
render.mouse = mouse;

// fit the render viewport to the scene
Render.lookAt(render, Composite.allBodies(world));

// wrapping using matter-wrap plugin
for (let i = 0; i < stack.bodies.length; i += 1) {
    stack.bodies[i].plugin.wrap = {
        min: { x: render.bounds.min.x, y: render.bounds.min.y },
        max: { x: render.bounds.max.x, y: render.bounds.max.y }
    };
}

*/
