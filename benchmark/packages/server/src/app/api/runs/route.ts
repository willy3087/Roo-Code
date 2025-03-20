import { NextResponse } from "next/server"

import { db, runs, insertRunSchema } from "@benchmark/db"

export async function POST(request: Request) {
	try {
		const run = await db
			.insert(runs)
			.values({
				...insertRunSchema.parse(await request.json()),
				createdAt: new Date(),
			})
			.returning()

		return NextResponse.json({ run }, { status: 201 })
	} catch (error) {
		return NextResponse.json({ error: (error as Error).message }, { status: 500 })
	}
}
