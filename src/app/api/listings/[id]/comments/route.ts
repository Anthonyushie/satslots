import {
  ok,
  readJson,
  requireUser,
  route,
} from "@/lib/api/handler";
import { commentCreateSchema } from "@/lib/api/schemas";
import { isSameOrigin, jsonError } from "@/lib/auth/http";
import { getMongo } from "@/lib/mongodb/client";
import { getListingById } from "@/lib/mongodb/queries";
import { ListingComment, Profile } from "@/lib/mongodb/schemas";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST /api/listings/:id/comments — add to a room's thread.
 */
export async function POST(
  request: Request,
  { params }: Context,
): Promise<Response> {
  return route(async () => {
    if (!isSameOrigin(request)) {
      return jsonError("Cross-origin request rejected.", 403);
    }

    const auth = await requireUser();
    if (!auth.user) return auth.response;

    const { id } = await params;
    if (!UUID.test(id)) return jsonError("Unknown room.", 404);

    const body = await readJson(request, commentCreateSchema);
    if (!body.data) return body.response;

    await getMongo();

    // Check listing exists
    const listing = await getListingById(id);
    if (!listing) return jsonError("Unknown room.", 404);

    const commentId = crypto.randomUUID();
    const comment = new ListingComment({
      id: commentId,
      listing_id: id,
      pubkey: auth.user.pubkey,
      comment: body.data.body,
    });
    await comment.save();

    const profile = await Profile.findOne({ pubkey: auth.user.pubkey });

    return ok({
      comment: {
        id: commentId,
        listingId: id,
        authorPubkey: auth.user.pubkey,
        authorUsername: profile?.username || "",
        body: body.data.body,
        createdAt: comment.created_at.toISOString(),
      },
    }, 201);
  });
}

/**
 * DELETE /api/listings/:id/comments?commentId=... — withdraw a comment.
 */
export async function DELETE(
  request: Request,
  { params }: Context,
): Promise<Response> {
  return route(async () => {
    if (!isSameOrigin(request)) {
      return jsonError("Cross-origin request rejected.", 403);
    }

    const auth = await requireUser();
    if (!auth.user) return auth.response;

    const { id } = await params;
    if (!UUID.test(id)) return jsonError("Unknown room.", 404);

    const commentId = new URL(request.url).searchParams.get("commentId");
    if (!commentId || !UUID.test(commentId)) {
      return jsonError("A comment id is required.", 400);
    }

    await getMongo();

    const result = await ListingComment.findOneAndDelete({
      id: commentId,
      listing_id: id,
    });

    if (!result) return jsonError("Unknown comment.", 404);
    return ok({ deleted: commentId });
  });
}
