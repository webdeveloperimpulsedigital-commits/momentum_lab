import { Router } from "express";
import {
  clearSessionCookie,
  loginWithPassword,
  readSession,
  requireAuth,
  sessionToUser,
  setSessionCookie
} from "./auth.js";
import {
  createDevelopedRoute,
  createGlobalSource,
  createGlobalFileSource,
  createGlobalSourceSignedUrl,
  createMessagePair,
  createProject,
  createProjectNote,
  createProjectSource,
  createCampaignBlueprintRevisionNote,
  createPitchDeckHandoffRevisionNote,
  createPitchDeckHandoffReviewNote,
  createRouteRevisionNote,
  createProjectFileSource,
  createProjectSourceSignedUrl,
  createRejectedIdea,
  createShortlistedIdea,
  archiveGlobalSource,
  archiveProjectSource,
  deleteProject,
  deleteProjectNote,
  developProjectRoute,
  getProject,
  getProjectWorkspace,
  generateContextPack,
  generateProjectDossier,
  generateProjectIdeaEvaluations,
  generateProjectIdeaCards,
  generateCampaignBlueprint,
  generatePitchDeckHandoff,
  generatePitchDeckHandoffReview,
  getSettings,
  getSourceContentSummary,
  isAdminUser,
  listGlobalSources,
  listMessages,
  listProjectDossiers,
  listProjectIdeaEvaluations,
  listProjectIdeaCards,
  listProjects,
  listProjectSources,
  listCampaignBlueprintRevisionNotes,
  listPitchDeckHandoffRevisionNotes,
  listPitchDeckHandoffReviewNotes,
  listRouteRevisionNotes,
  listSourceChunks,
  processGlobalSource,
  processProjectSource,
  embedGlobalSource,
  embedProjectSource,
  searchAllowedSources,
  searchGlobalSources,
  semanticSearchAllowedSources,
  updateDevelopedRoute,
  updateGlobalSource,
  updateProject,
  updateProjectNote,
  updateProjectSource,
  updateProjectIdeaCardStatus,
  updateSettings,
  upsertFinalCampaignTruth
} from "./store.js";
import {
  finalTruthUpsertSchema,
  campaignBlueprintGenerateSchema,
  campaignBlueprintRevisionNoteSchema,
  pitchDeckHandoffGenerateSchema,
  pitchDeckHandoffRevisionNoteSchema,
  pitchDeckHandoffReviewGenerateSchema,
  pitchDeckHandoffReviewNoteSchema,
  loginSchema,
  messageCreateSchema,
  noteCreateSchema,
  notePatchSchema,
  projectCreateSchema,
  projectPatchSchema,
  rejectedIdeaCreateSchema,
  routeCreateSchema,
  routeDevelopSchema,
  routePatchSchema,
  routeRevisionNoteSchema,
  shortlistedIdeaCreateSchema,
  sourceInputSchema,
  sourcePatchSchema,
  embedSourceSchema,
  contextPackSchema,
  dossierGenerateSchema,
  ideationGenerateSchema,
  ideaEvaluationGenerateSchema,
  ideaStatusUpdateSchema,
  sourceSearchSchema,
  settingsPatchSchema
} from "./validation.js";
import { uploadMiddleware, validateUploadFile } from "./uploads.js";

export const apiRouter = Router();

apiRouter.post("/auth/login", async (req, res, next) => {
  try {
    const credentials = loginSchema.parse(req.body);
    const session = await loginWithPassword(credentials.email, credentials.password);

    if (!session) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    setSessionCookie(res, session);
    res.json({ user: sessionToUser(session) });
  } catch (error) {
    next(error);
  }
});

apiRouter.post("/auth/logout", (_req, res) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});

apiRouter.get("/auth/me", (req, res) => {
  const session = readSession(req);
  res.json({ user: session ? sessionToUser(session) : null });
});

apiRouter.use(requireAuth);

apiRouter.get("/projects", async (req, res, next) => {
  try {
    res.json({ projects: await listProjects(req.user!.id) });
  } catch (error) {
    next(error);
  }
});

apiRouter.post("/projects", async (req, res, next) => {
  try {
    const input = projectCreateSchema.parse(req.body);
    const project = await createProject(req.user!.id, input);
    res.status(201).json({ project });
  } catch (error) {
    next(error);
  }
});

apiRouter.get("/projects/:id", async (req, res, next) => {
  try {
    const project = await getProject(req.user!.id, req.params.id);
    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    res.json({ project });
  } catch (error) {
    next(error);
  }
});

apiRouter.patch("/projects/:id", async (req, res, next) => {
  try {
    const patch = projectPatchSchema.parse(req.body);
    const project = await updateProject(req.user!.id, req.params.id, patch);
    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    res.json({ project });
  } catch (error) {
    next(error);
  }
});

apiRouter.delete("/projects/:id", async (req, res, next) => {
  try {
    const deleted = await deleteProject(req.user!.id, req.params.id);
    if (!deleted) {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

apiRouter.get("/projects/:id/messages", async (req, res, next) => {
  try {
    const messages = await listMessages(req.user!.id, req.params.id);
    if (!messages) {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    res.json({ messages });
  } catch (error) {
    next(error);
  }
});

apiRouter.post("/projects/:id/messages", async (req, res, next) => {
  try {
    const input = messageCreateSchema.parse(req.body);
    const messages = await createMessagePair(req.user!.id, req.params.id, input.content);
    if (!messages) {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    res.status(201).json({ messages });
  } catch (error) {
    next(error);
  }
});

apiRouter.get("/projects/:id/workspace", async (req, res, next) => {
  try {
    const workspace = await getProjectWorkspace(req.user!.id, req.params.id);
    if (!workspace) {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    res.json({ workspace });
  } catch (error) {
    next(error);
  }
});

apiRouter.post("/projects/:id/notes", async (req, res, next) => {
  try {
    const input = noteCreateSchema.parse(req.body);
    const note = await createProjectNote(req.user!.id, req.params.id, input.content);
    if (!note) {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    res.status(201).json({ note });
  } catch (error) {
    next(error);
  }
});

apiRouter.patch("/projects/:id/notes/:noteId", async (req, res, next) => {
  try {
    const patch = notePatchSchema.parse(req.body);
    const note = await updateProjectNote(
      req.user!.id,
      req.params.id,
      req.params.noteId,
      patch
    );
    if (!note) {
      res.status(404).json({ error: "Note not found" });
      return;
    }
    res.json({ note });
  } catch (error) {
    next(error);
  }
});

apiRouter.delete("/projects/:id/notes/:noteId", async (req, res, next) => {
  try {
    const deleted = await deleteProjectNote(req.user!.id, req.params.id, req.params.noteId);
    if (!deleted) {
      res.status(404).json({ error: "Note not found" });
      return;
    }
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

apiRouter.post("/projects/:id/rejected-ideas", async (req, res, next) => {
  try {
    const input = rejectedIdeaCreateSchema.parse(req.body);
    const idea = await createRejectedIdea(req.user!.id, req.params.id, input);
    if (!idea) {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    res.status(201).json({ idea });
  } catch (error) {
    next(error);
  }
});

apiRouter.post("/projects/:id/shortlisted-ideas", async (req, res, next) => {
  try {
    const input = shortlistedIdeaCreateSchema.parse(req.body);
    const idea = await createShortlistedIdea(req.user!.id, req.params.id, input);
    if (!idea) {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    res.status(201).json({ idea });
  } catch (error) {
    next(error);
  }
});

apiRouter.post("/projects/:id/routes", async (req, res, next) => {
  try {
    const input = routeCreateSchema.parse(req.body);
    const route = await createDevelopedRoute(req.user!.id, req.params.id, input);
    if (!route) {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    res.status(201).json({ route });
  } catch (error) {
    next(error);
  }
});

apiRouter.patch("/projects/:id/routes/:routeId", async (req, res, next) => {
  try {
    const patch = routePatchSchema.parse(req.body);
    const route = await updateDevelopedRoute(
      req.user!.id,
      req.params.id,
      req.params.routeId,
      patch
    );
    if (!route) {
      res.status(404).json({ error: "Route not found" });
      return;
    }
    res.json({ route });
  } catch (error) {
    next(error);
  }
});

apiRouter.post("/projects/:id/routes/develop", async (req, res, next) => {
  try {
    const input = routeDevelopSchema.parse(req.body ?? {});
    const result = await developProjectRoute(req.user!.id, req.params.id, input);
    if (!result) {
      res.status(404).json({ error: "Project, idea card, dossier, evaluation, or route scope not found" });
      return;
    }
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

apiRouter.get("/projects/:id/route-revision-notes", async (req, res, next) => {
  try {
    const notes = await listRouteRevisionNotes(req.user!.id, req.params.id);
    if (!notes) {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    res.json({ notes });
  } catch (error) {
    next(error);
  }
});

apiRouter.post("/projects/:id/routes/:routeId/revision-notes", async (req, res, next) => {
  try {
    const input = routeRevisionNoteSchema.parse(req.body ?? {});
    const note = await createRouteRevisionNote(
      req.user!.id,
      req.params.id,
      req.params.routeId,
      input.note
    );
    if (!note) {
      res.status(404).json({ error: "Route not found" });
      return;
    }
    res.status(201).json({ note });
  } catch (error) {
    next(error);
  }
});

apiRouter.put("/projects/:id/final-truth", async (req, res, next) => {
  try {
    const input = finalTruthUpsertSchema.parse(req.body);
    const finalTruth = await upsertFinalCampaignTruth(
      req.user!.id,
      req.params.id,
      input
    );
    if (!finalTruth) {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    res.json({ finalTruth });
  } catch (error) {
    next(error);
  }
});

apiRouter.post("/projects/:id/campaign-blueprints/generate", async (req, res, next) => {
  try {
    const input = campaignBlueprintGenerateSchema.parse(req.body ?? {});
    const result = await generateCampaignBlueprint(req.user!.id, req.params.id, input);
    if (!result) {
      res.status(404).json({ error: "Project, final selection, route, dossier, evaluation, or context not found" });
      return;
    }
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

apiRouter.get("/projects/:id/campaign-blueprint-revision-notes", async (req, res, next) => {
  try {
    const notes = await listCampaignBlueprintRevisionNotes(req.user!.id, req.params.id);
    if (!notes) {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    res.json({ notes });
  } catch (error) {
    next(error);
  }
});

apiRouter.post("/projects/:id/campaign-blueprints/:blueprintId/revision-notes", async (req, res, next) => {
  try {
    const input = campaignBlueprintRevisionNoteSchema.parse(req.body ?? {});
    const note = await createCampaignBlueprintRevisionNote(
      req.user!.id,
      req.params.id,
      req.params.blueprintId,
      input.note
    );
    if (!note) {
      res.status(404).json({ error: "Campaign blueprint not found" });
      return;
    }
    res.status(201).json({ note });
  } catch (error) {
    next(error);
  }
});

apiRouter.post("/projects/:id/pitch-deck-handoffs/generate", async (req, res, next) => {
  try {
    const input = pitchDeckHandoffGenerateSchema.parse(req.body ?? {});
    const result = await generatePitchDeckHandoff(req.user!.id, req.params.id, input);
    if (!result) {
      res.status(404).json({ error: "Project, campaign blueprint, final selection, route, or context not found" });
      return;
    }
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

apiRouter.get("/projects/:id/pitch-deck-handoff-revision-notes", async (req, res, next) => {
  try {
    const notes = await listPitchDeckHandoffRevisionNotes(req.user!.id, req.params.id);
    if (!notes) {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    res.json({ notes });
  } catch (error) {
    next(error);
  }
});

apiRouter.post("/projects/:id/pitch-deck-handoffs/:handoffId/revision-notes", async (req, res, next) => {
  try {
    const input = pitchDeckHandoffRevisionNoteSchema.parse(req.body ?? {});
    const note = await createPitchDeckHandoffRevisionNote(
      req.user!.id,
      req.params.id,
      req.params.handoffId,
      input.note
    );
    if (!note) {
      res.status(404).json({ error: "Pitch deck handoff not found" });
      return;
    }
    res.status(201).json({ note });
  } catch (error) {
    next(error);
  }
});

apiRouter.post("/projects/:id/pitch-deck-handoff-reviews/generate", async (req, res, next) => {
  try {
    const input = pitchDeckHandoffReviewGenerateSchema.parse(req.body ?? {});
    const result = await generatePitchDeckHandoffReview(req.user!.id, req.params.id, input);
    if (!result) {
      res.status(404).json({ error: "Project, pitch deck handoff, or context not found" });
      return;
    }
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

apiRouter.get("/projects/:id/pitch-deck-handoff-review-notes", async (req, res, next) => {
  try {
    const notes = await listPitchDeckHandoffReviewNotes(req.user!.id, req.params.id);
    if (!notes) {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    res.json({ notes });
  } catch (error) {
    next(error);
  }
});

apiRouter.post("/projects/:id/pitch-deck-handoff-reviews/:reviewId/notes", async (req, res, next) => {
  try {
    const input = pitchDeckHandoffReviewNoteSchema.parse(req.body ?? {});
    const note = await createPitchDeckHandoffReviewNote(
      req.user!.id,
      req.params.id,
      req.params.reviewId,
      input.note
    );
    if (!note) {
      res.status(404).json({ error: "Pitch deck handoff review not found" });
      return;
    }
    res.status(201).json({ note });
  } catch (error) {
    next(error);
  }
});

apiRouter.get("/global-sources", async (req, res, next) => {
  try {
    if (!(await isAdminUser(req.user!.id))) {
      res.status(403).json({ error: "Admin access required" });
      return;
    }
    res.json({ sources: await listGlobalSources() });
  } catch (error) {
    next(error);
  }
});

apiRouter.get("/global-sources/search", async (req, res, next) => {
  try {
    const filters = sourceSearchSchema.parse({ ...req.query, scope: "global" });
    const results =
      filters.mode === "semantic"
        ? await semanticSearchAllowedSources(req.user!.id, null, filters)
        : await searchGlobalSources(req.user!.id, filters);
    if (!results) {
      res.status(403).json({ error: "Admin access required" });
      return;
    }
    res.json({ results });
  } catch (error) {
    next(error);
  }
});

apiRouter.post("/global-sources/context-pack", async (req, res, next) => {
  try {
    const input = contextPackSchema.parse({
      ...req.body,
      retrieval_scope: "global_only"
    });
    const contextPack = await generateContextPack(req.user!.id, null, input);
    if (!contextPack) {
      res.status(403).json({ error: "Admin access required" });
      return;
    }
    res.json({ contextPack });
  } catch (error) {
    next(error);
  }
});

apiRouter.post("/global-sources", async (req, res, next) => {
  try {
    if (!(await isAdminUser(req.user!.id))) {
      res.status(403).json({ error: "Admin access required" });
      return;
    }
    const input = sourceInputSchema.parse(req.body);
    res.status(201).json({ source: await createGlobalSource(req.user!.id, input) });
  } catch (error) {
    next(error);
  }
});

apiRouter.post(
  "/global-sources/upload",
  uploadMiddleware.single("file"),
  async (req, res, next) => {
    try {
      if (!(await isAdminUser(req.user!.id))) {
        res.status(403).json({ error: "Admin access required" });
        return;
      }
      const fileError = validateUploadFile(req.file);
      if (fileError) {
        res.status(400).json({ error: fileError });
        return;
      }
      const input = sourceInputSchema.parse(parseMultipartSource(req.body));
      const source = await createGlobalFileSource(req.user!.id, input, req.file!);
      res.status(201).json({ source });
    } catch (error) {
      next(error);
    }
  }
);

apiRouter.patch("/global-sources/:sourceId", async (req, res, next) => {
  try {
    if (!(await isAdminUser(req.user!.id))) {
      res.status(403).json({ error: "Admin access required" });
      return;
    }
    const patch = sourcePatchSchema.parse(req.body);
    const source = await updateGlobalSource(req.params.sourceId, patch);
    if (!source) {
      res.status(404).json({ error: "Global source not found" });
      return;
    }
    res.json({ source });
  } catch (error) {
    next(error);
  }
});

apiRouter.delete("/global-sources/:sourceId", async (req, res, next) => {
  try {
    if (!(await isAdminUser(req.user!.id))) {
      res.status(403).json({ error: "Admin access required" });
      return;
    }
    const source = await archiveGlobalSource(req.params.sourceId);
    if (!source) {
      res.status(404).json({ error: "Global source not found" });
      return;
    }
    res.json({ source });
  } catch (error) {
    next(error);
  }
});

apiRouter.get("/global-sources/:sourceId/download", async (req, res, next) => {
  try {
    const signedUrl = await createGlobalSourceSignedUrl(req.user!.id, req.params.sourceId);
    if (!signedUrl) {
      res.status(404).json({ error: "Global source file not found" });
      return;
    }
    res.json({ signedUrl });
  } catch (error) {
    next(error);
  }
});

apiRouter.post("/global-sources/:sourceId/process", async (req, res, next) => {
  try {
    const source = await processGlobalSource(req.user!.id, req.params.sourceId);
    if (!source) {
      res.status(404).json({ error: "Global source not found" });
      return;
    }
    res.json({ source });
  } catch (error) {
    next(error);
  }
});

apiRouter.post("/global-sources/:sourceId/embed", async (req, res, next) => {
  try {
    const input = embedSourceSchema.parse(req.body ?? {});
    const source = await embedGlobalSource(req.user!.id, req.params.sourceId, input.force);
    if (!source) {
      res.status(404).json({ error: "Global source not found or not ready for embedding" });
      return;
    }
    res.json({ source });
  } catch (error) {
    next(error);
  }
});

apiRouter.get("/global-sources/:sourceId/content", async (req, res, next) => {
  try {
    const content = await getSourceContentSummary({
      userId: req.user!.id,
      scope: "global",
      sourceId: req.params.sourceId
    });
    if (!content) {
      res.status(404).json({ error: "Extracted content not found" });
      return;
    }
    res.json({ content });
  } catch (error) {
    next(error);
  }
});

apiRouter.get("/global-sources/:sourceId/chunks", async (req, res, next) => {
  try {
    const chunks = await listSourceChunks({
      userId: req.user!.id,
      scope: "global",
      sourceId: req.params.sourceId
    });
    if (!chunks) {
      res.status(404).json({ error: "Source chunks not found" });
      return;
    }
    res.json({ chunks });
  } catch (error) {
    next(error);
  }
});

apiRouter.get("/projects/:id/sources", async (req, res, next) => {
  try {
    const sources = await listProjectSources(req.user!.id, req.params.id);
    if (!sources) {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    res.json({ sources });
  } catch (error) {
    next(error);
  }
});

apiRouter.get("/projects/:id/source-search", async (req, res, next) => {
  try {
    const filters = sourceSearchSchema.parse(req.query);
    const results =
      filters.mode === "semantic"
        ? await semanticSearchAllowedSources(req.user!.id, req.params.id, filters)
        : await searchAllowedSources(req.user!.id, req.params.id, filters);
    if (!results) {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    res.json({ results });
  } catch (error) {
    next(error);
  }
});

apiRouter.get("/projects/:id/dossiers", async (req, res, next) => {
  try {
    const dossiers = await listProjectDossiers(req.user!.id, req.params.id);
    if (!dossiers) {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    res.json({ dossiers });
  } catch (error) {
    next(error);
  }
});

apiRouter.post("/projects/:id/dossiers", async (req, res, next) => {
  try {
    const input = dossierGenerateSchema.parse(req.body ?? {});
    const result = await generateProjectDossier(req.user!.id, req.params.id, input);
    if (!result) {
      res.status(404).json({ error: "Project not found or dossier scope is not allowed" });
      return;
    }
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

apiRouter.get("/projects/:id/idea-cards", async (req, res, next) => {
  try {
    const ideas = await listProjectIdeaCards(req.user!.id, req.params.id);
    if (!ideas) {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    res.json({ ideas });
  } catch (error) {
    next(error);
  }
});

apiRouter.post("/projects/:id/idea-cards/generate", async (req, res, next) => {
  try {
    const input = ideationGenerateSchema.parse(req.body ?? {});
    const result = await generateProjectIdeaCards(req.user!.id, req.params.id, input);
    if (!result) {
      res.status(404).json({ error: "Project, dossier, or ideation scope not found" });
      return;
    }
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

apiRouter.post("/projects/:id/idea-cards/:ideaId/reject", async (req, res, next) => {
  try {
    const input = ideaStatusUpdateSchema.parse(req.body ?? {});
    const idea = await updateProjectIdeaCardStatus(
      req.user!.id,
      req.params.id,
      req.params.ideaId,
      { status: "rejected", reason: input.reason }
    );
    if (!idea) {
      res.status(404).json({ error: "Idea card not found" });
      return;
    }
    res.json({ idea });
  } catch (error) {
    next(error);
  }
});

apiRouter.post("/projects/:id/idea-cards/:ideaId/shortlist", async (req, res, next) => {
  try {
    const input = ideaStatusUpdateSchema.parse(req.body ?? {});
    const idea = await updateProjectIdeaCardStatus(
      req.user!.id,
      req.params.id,
      req.params.ideaId,
      { status: "shortlisted", reason: input.reason }
    );
    if (!idea) {
      res.status(404).json({ error: "Idea card not found" });
      return;
    }
    res.json({ idea });
  } catch (error) {
    next(error);
  }
});

apiRouter.get("/projects/:id/idea-evaluations", async (req, res, next) => {
  try {
    const evaluations = await listProjectIdeaEvaluations(req.user!.id, req.params.id);
    if (!evaluations) {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    res.json({ evaluations });
  } catch (error) {
    next(error);
  }
});

apiRouter.post("/projects/:id/idea-evaluations/generate", async (req, res, next) => {
  try {
    const input = ideaEvaluationGenerateSchema.parse(req.body ?? {});
    const result = await generateProjectIdeaEvaluations(req.user!.id, req.params.id, input);
    if (!result) {
      res.status(404).json({ error: "Project, idea card, dossier, or evaluation scope not found" });
      return;
    }
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

apiRouter.post("/projects/:id/context-pack", async (req, res, next) => {
  try {
    const input = contextPackSchema.parse(req.body ?? {});
    const contextPack = await generateContextPack(req.user!.id, req.params.id, input);
    if (!contextPack) {
      res.status(404).json({ error: "Project not found or context scope is not allowed" });
      return;
    }
    res.json({ contextPack });
  } catch (error) {
    next(error);
  }
});

apiRouter.post("/projects/:id/sources", async (req, res, next) => {
  try {
    const input = sourceInputSchema.parse(req.body);
    const source = await createProjectSource(req.user!.id, req.params.id, input);
    if (!source) {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    res.status(201).json({ source });
  } catch (error) {
    next(error);
  }
});

apiRouter.post(
  "/projects/:id/sources/upload",
  uploadMiddleware.single("file"),
  async (req, res, next) => {
    try {
      const fileError = validateUploadFile(req.file);
      if (fileError) {
        res.status(400).json({ error: fileError });
        return;
      }
      const input = sourceInputSchema.parse(parseMultipartSource(req.body));
      const source = await createProjectFileSource(
        req.user!.id,
        req.params.id,
        input,
        req.file!
      );
      if (!source) {
        res.status(404).json({ error: "Project not found" });
        return;
      }
      res.status(201).json({ source });
    } catch (error) {
      next(error);
    }
  }
);

apiRouter.patch("/projects/:id/sources/:sourceId", async (req, res, next) => {
  try {
    const patch = sourcePatchSchema.parse(req.body);
    const source = await updateProjectSource(
      req.user!.id,
      req.params.id,
      req.params.sourceId,
      patch
    );
    if (!source) {
      res.status(404).json({ error: "Project source not found" });
      return;
    }
    res.json({ source });
  } catch (error) {
    next(error);
  }
});

apiRouter.delete("/projects/:id/sources/:sourceId", async (req, res, next) => {
  try {
    const source = await archiveProjectSource(
      req.user!.id,
      req.params.id,
      req.params.sourceId
    );
    if (!source) {
      res.status(404).json({ error: "Project source not found" });
      return;
    }
    res.json({ source });
  } catch (error) {
    next(error);
  }
});

apiRouter.get("/projects/:id/sources/:sourceId/download", async (req, res, next) => {
  try {
    const signedUrl = await createProjectSourceSignedUrl(
      req.user!.id,
      req.params.id,
      req.params.sourceId
    );
    if (!signedUrl) {
      res.status(404).json({ error: "Project source file not found" });
      return;
    }
    res.json({ signedUrl });
  } catch (error) {
    next(error);
  }
});

apiRouter.post("/projects/:id/sources/:sourceId/process", async (req, res, next) => {
  try {
    const source = await processProjectSource(
      req.user!.id,
      req.params.id,
      req.params.sourceId
    );
    if (!source) {
      res.status(404).json({ error: "Project source not found" });
      return;
    }
    res.json({ source });
  } catch (error) {
    next(error);
  }
});

apiRouter.post("/projects/:id/sources/:sourceId/embed", async (req, res, next) => {
  try {
    const input = embedSourceSchema.parse(req.body ?? {});
    const source = await embedProjectSource(
      req.user!.id,
      req.params.id,
      req.params.sourceId,
      input.force
    );
    if (!source) {
      res.status(404).json({ error: "Project source not found or not ready for embedding" });
      return;
    }
    res.json({ source });
  } catch (error) {
    next(error);
  }
});

apiRouter.get("/projects/:id/sources/:sourceId/content", async (req, res, next) => {
  try {
    const content = await getSourceContentSummary({
      userId: req.user!.id,
      scope: "project",
      projectId: req.params.id,
      sourceId: req.params.sourceId
    });
    if (!content) {
      res.status(404).json({ error: "Extracted content not found" });
      return;
    }
    res.json({ content });
  } catch (error) {
    next(error);
  }
});

apiRouter.get("/projects/:id/sources/:sourceId/chunks", async (req, res, next) => {
  try {
    const chunks = await listSourceChunks({
      userId: req.user!.id,
      scope: "project",
      projectId: req.params.id,
      sourceId: req.params.sourceId
    });
    if (!chunks) {
      res.status(404).json({ error: "Source chunks not found" });
      return;
    }
    res.json({ chunks });
  } catch (error) {
    next(error);
  }
});

apiRouter.get("/settings", async (_req, res, next) => {
  try {
    res.json({ settings: await getSettings() });
  } catch (error) {
    next(error);
  }
});

apiRouter.patch("/settings", async (req, res, next) => {
  try {
    const patch = settingsPatchSchema.parse(req.body);
    res.json({ settings: await updateSettings(patch) });
  } catch (error) {
    next(error);
  }
});

function parseMultipartSource(body: Record<string, unknown>) {
  const rawTags = typeof body.tags === "string" ? body.tags : "";
  return {
    title: body.title,
    description: body.description,
    source_role: body.source_role,
    source_type: body.source_type,
    source_status: body.source_status,
    source_url: body.source_url,
    content_text: body.content_text,
    tags: rawTags
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean)
  };
}
