import { z } from 'zod';

export const PmnoidToolSchema = z.object({
    operation: z.enum(['create_task', 'get_sprint_summary', 'list_projects']),
    title: z.string().optional(),
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
    project_id: z.string().optional(),
});

export type PmnoidToolParams = z.infer<typeof PmnoidToolSchema>;

// Simulation State (in-memory for the session)
const TASKS: any[] = [
    { id: 'TASK-101', title: 'Integrate Lehro AI', priority: 'HIGH', status: 'IN_PROGRESS' },
    { id: 'TASK-102', title: 'Update Tax Modules', priority: 'MEDIUM', status: 'TODO' }
];

export async function handlePmnoid(params: any): Promise<string> {
    const validated = PmnoidToolSchema.parse(params);

    if (validated.operation === 'create_task') {
        if (!validated.title) throw new Error("Title is required to create a task");

        const newTask = {
            id: `TASK-${103 + TASKS.length}`,
            title: validated.title,
            priority: validated.priority || 'MEDIUM',
            status: 'TODO',
            created_at: new Date().toISOString()
        };
        TASKS.push(newTask);

        return JSON.stringify({
            message: "Task created successfully",
            task: newTask,
            simulation_mode: true
        }, null, 2);
    }

    if (validated.operation === 'get_sprint_summary') {
        const total = TASKS.length;
        const inProgress = TASKS.filter(t => t.status === 'IN_PROGRESS').length;

        return JSON.stringify({
            sprint: "Sprint 23.4",
            velocity: 42,
            active_tasks: total,
            in_progress: inProgress,
            blockers: 0,
            tasks: TASKS
        }, null, 2);
    }

    if (validated.operation === 'list_projects') {
        return JSON.stringify({
            projects: [
                { id: 'PRJ-001', name: 'Super Tool Integration', owner: 'Antigravity' },
                { id: 'PRJ-002', name: 'Legacy Migration', owner: 'DevTeam' }
            ]
        }, null, 2);
    }

    return "Operation not implemented";
}

export const PMNOID_TOOL_DEFINITION = {
    name: "project_management",
    description: "Connects to PMNOID for project tracking and sprint management (Simulation Mode).",
    inputSchema: {
        type: "object",
        properties: {
            operation: {
                type: "string",
                enum: ['create_task', 'get_sprint_summary', 'list_projects']
            },
            title: { type: "string" },
            priority: { type: "string", enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] },
            project_id: { type: "string" }
        },
        required: ["operation"]
    }
};
