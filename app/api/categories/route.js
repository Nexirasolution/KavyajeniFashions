export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { dbConnect } from '@/lib/mongodb';
import Category from '@/models/Category';
import slugify from 'slugify';
import { requireAdmin } from '@/lib/apiAuth';

export async function GET(req) {
  await dbConnect();

  const { searchParams } = new URL(req.url);
  const parentParam = searchParams.get('parent'); // 'root' | a category id/slug | omitted
  const includeInactive = searchParams.get('includeInactive') === 'true';

  const filter = {};
  if (!includeInactive) filter.isActive = true;

  if (parentParam === 'root') {
    // Only top-level categories (no parent)
    filter.parent = null;
  } else if (parentParam) {
    // Accept either an ObjectId or a slug for the parent
    const parentCategory = mongoose.isValidObjectId(parentParam)
      ? await Category.findById(parentParam)
      : await Category.findOne({ slug: parentParam });
    filter.parent = parentCategory ? parentCategory._id : null;
  }

  const categories = await Category.find(filter).sort({ sortOrder: 1, name: 1 });
  return NextResponse.json({ categories });
}

export const POST = requireAdmin(async (req) => {
  await dbConnect();
  const body = await req.json();
  if (!body.name) return NextResponse.json({ error: 'Category name is required' }, { status: 400 });

  const slug = body.slug ? slugify(body.slug, { lower: true }) : slugify(body.name, { lower: true });
  const exists = await Category.findOne({ slug });
  if (exists) return NextResponse.json({ error: 'A category with this slug already exists' }, { status: 409 });

  // Validate parent (if provided) actually exists, and normalize empty string -> null
  let parent = null;
  if (body.parent) {
    if (!mongoose.isValidObjectId(body.parent)) {
      return NextResponse.json({ error: 'Invalid parent category' }, { status: 400 });
    }
    const parentDoc = await Category.findById(body.parent);
    if (!parentDoc) return NextResponse.json({ error: 'Parent category not found' }, { status: 404 });
    parent = parentDoc._id;
  }

  const category = await Category.create({ ...body, slug, parent });
  return NextResponse.json({ category }, { status: 201 });
});