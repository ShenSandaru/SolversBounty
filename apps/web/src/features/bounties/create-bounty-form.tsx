"use client";

import {
  formatLamportsAsSol,
  parseSolToLamports,
  principalLamports,
  type BountyCategory,
  type VerificationMethod,
} from "@solversbounty/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { categoryLabels, difficultyLabels, verificationMethodLabels } from "@/lib/labels";
import { useAuthSession } from "@/features/auth/auth-session";
import { apiBaseUrl } from "@/features/auth/auth-client";
import { BountyClientError, bountyWriteBody, createBounty, updateBounty, type BountyDraft } from "./bounty-api";
import { createBountyFormSchema, type CreateBountyFormValues } from "./create-bounty-schema";

const categories = Object.entries(categoryLabels) as [BountyCategory, string][];
const methods = Object.entries(verificationMethodLabels) as [VerificationMethod, string][];
const difficulties = Object.entries(difficultyLabels);

export function CreateBountyForm({
  bountyId,
  initial,
}: {
  bountyId?: string;
  initial?: Partial<CreateBountyFormValues>;
}) {
  const { session } = useAuthSession();
  const [saved, setSaved] = useState<BountyDraft | null>(null);
  const [phase, setPhase] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const schema = useMemo(() => createBountyFormSchema(new Date()), []);
  const form = useForm<CreateBountyFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: "",
      description: "",
      instructions: "",
      prompt: "",
      category: "logic",
      expectedAnswer: "",
      verificationMethod: "exact",
      rewardSol: "",
      maxRewardedSolvers: 10,
      attemptLimit: 3,
      deadline: "",
      difficulty: "introductory",
      consentAcknowledged: false,
      ...initial,
    },
  });

  const rewardSol = useWatch({ control: form.control, name: "rewardSol" });
  const maxRewardedSolvers = useWatch({ control: form.control, name: "maxRewardedSolvers" });
  const rewardLamports = parseSolToLamports(rewardSol);
  const principal =
    rewardLamports !== null && Number.isInteger(maxRewardedSolvers) && maxRewardedSolvers > 0
      ? formatLamportsAsSol(principalLamports(rewardLamports, maxRewardedSolvers))
      : null;

  return (
    <form
      className="mt-6 grid gap-8"
      method="post"
      action="/bounties/create"
      autoComplete="off"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit(async (values) => {
          if (!session) {
            setPhase("error");
            setMessage("Sign in before saving a draft.");
            return;
          }
          setPhase("saving");
          setMessage(null);
          try {
            const body = bountyWriteBody(values);
            const draft = bountyId
              ? await updateBounty(apiBaseUrl(), session.csrfToken, bountyId, body)
              : await createBounty(apiBaseUrl(), session.csrfToken, body);
            setSaved(draft);
            setPhase("saved");
          } catch (caught) {
            setSaved(null);
            setPhase("error");
            setMessage(caught instanceof BountyClientError ? caught.message : "The bounty could not be saved.");
          }
        })(event);
      }}
    >
      <section className="grid gap-4 rounded-xl border border-border bg-card p-4 sm:p-6">
        <h2 className="text-lg font-semibold">Challenge</h2>
        <Field label="Bounty title" error={form.formState.errors.title?.message} htmlFor="title">
          <Input id="title" {...form.register("title")} />
        </Field>
        <Field
          label="Description"
          error={form.formState.errors.description?.message}
          htmlFor="description"
        >
          <Textarea id="description" {...form.register("description")} />
        </Field>
        <Field
          label="Challenge question"
          error={form.formState.errors.prompt?.message}
          htmlFor="prompt"
        >
          <Textarea id="prompt" {...form.register("prompt")} />
        </Field>
        <Field
          label="Instructions"
          error={form.formState.errors.instructions?.message}
          htmlFor="instructions"
          hint="Optional public guidance. Do not put the expected answer here."
        >
          <Textarea id="instructions" {...form.register("instructions")} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Category" error={form.formState.errors.category?.message} htmlFor="category">
            <Select id="category" {...form.register("category")}>
              {categories.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="Difficulty"
            error={form.formState.errors.difficulty?.message}
            htmlFor="difficulty"
            hint="Preview label only. It is not a stored bounty field."
          >
            <Select id="difficulty" {...form.register("difficulty")}>
              {difficulties.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="Verification method"
            error={form.formState.errors.verificationMethod?.message}
            htmlFor="verificationMethod"
          >
            <Select id="verificationMethod" {...form.register("verificationMethod")}>
              {methods.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field
          label="Expected answer"
          error={form.formState.errors.expectedAnswer?.message}
          htmlFor="expectedAnswer"
          hint="Sent only to the API, which stores it encrypted. Public lists do not include it."
        >
          <Input id="expectedAnswer" autoComplete="off" {...form.register("expectedAnswer")} />
        </Field>
      </section>

      <section className="grid gap-4 rounded-xl border border-border bg-card p-4 sm:p-6">
        <h2 className="text-lg font-semibold">Reward terms</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field
            label="Reward per solver (SOL)"
            error={form.formState.errors.rewardSol?.message}
            htmlFor="rewardSol"
            hint="Devnet SOL. The server will store lamports."
          >
            <Input id="rewardSol" inputMode="decimal" {...form.register("rewardSol")} />
          </Field>
          <Field
            label="Max rewarded solvers"
            error={form.formState.errors.maxRewardedSolvers?.message}
            htmlFor="maxRewardedSolvers"
          >
            <Input
              id="maxRewardedSolvers"
              type="number"
              min={1}
              {...form.register("maxRewardedSolvers", { valueAsNumber: true })}
            />
          </Field>
          <Field
            label="Attempt limit"
            error={form.formState.errors.attemptLimit?.message}
            htmlFor="attemptLimit"
            hint="Proposed maximum is 10."
          >
            <Input
              id="attemptLimit"
              type="number"
              min={1}
              max={10}
              {...form.register("attemptLimit", { valueAsNumber: true })}
            />
          </Field>
        </div>
        <Field label="Deadline" error={form.formState.errors.deadline?.message} htmlFor="deadline">
          <Input id="deadline" type="datetime-local" {...form.register("deadline")} />
        </Field>
        <p className="rounded-lg bg-muted px-3 py-2 text-sm">
          Principal{" "}
          <span className="font-mono text-reward">{principal ?? "—"} SOL</span>
          <span className="mt-1 block text-muted-foreground">
            Reward per solver times max rewarded solvers. This preview does not fund the pool.
          </span>
        </p>
      </section>

      <section className="grid gap-4 rounded-xl border border-border bg-card p-4 sm:p-6">
        <h2 className="text-lg font-semibold">Research consent</h2>
        <p className="text-sm leading-6 text-muted-foreground">
          Policy version research-consent-v1. A solving session cannot start until the solver
          accepts it. The record covers wallet address, attempts, times, submitted answers, and
          public chain transfers. The platform is privacy-conscious and pseudonymous.
        </p>
        <label className="flex items-start gap-3 text-sm leading-6">
          <input
            type="checkbox"
            className="mt-1 size-4"
            {...form.register("consentAcknowledged")}
          />
          <span>I understand solvers must accept this research consent before a session starts.</span>
        </label>
        {form.formState.errors.consentAcknowledged?.message ? (
          <p className="text-sm text-destructive" role="alert">
            {form.formState.errors.consentAcknowledged.message}
          </p>
        ) : null}
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={phase === "saving"}>
          {phase === "saving" ? "Saving draft" : bountyId ? "Update draft" : "Save draft"}
        </Button>
        <p className="text-sm text-muted-foreground">Saves a draft. It does not fund or activate the bounty.</p>
      </div>
      {message ? (
        <p className="text-sm text-destructive" role="alert">
          {message}
        </p>
      ) : null}

      {saved && phase === "saved" ? (
        <section className="rounded-xl border border-border bg-card p-4 sm:p-6" aria-live="polite">
          <h2 className="text-lg font-semibold">Draft saved</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {saved.title} is a draft. The expected answer is stored by the API and is not shown here.
            No deposit was created.
          </p>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Status</dt>
              <dd>{saved.status}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Reward pool</dt>
              <dd className="font-mono text-reward">{formatLamportsAsSol(BigInt(saved.principalLamports))} SOL</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Commission, paid separately</dt>
              <dd className="font-mono">{formatLamportsAsSol(BigInt(saved.commissionLamports))} SOL</dd>
            </div>
          </dl>
          <Button className="mt-4" variant="outline" asChild>
            <Link href={`/bounties/${saved.id}/edit`}>Edit draft</Link>
          </Button>
        </section>
      ) : null}
    </form>
  );
}

function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label htmlFor={htmlFor}>{label}</Label>
      <div className="mt-1.5">{children}</div>
      {hint ? <p className="mt-1.5 text-xs leading-5 text-muted-foreground">{hint}</p> : null}
      {error ? (
        <p className="mt-1.5 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
