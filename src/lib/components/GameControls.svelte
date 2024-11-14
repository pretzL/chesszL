<script>
    import { Dropdown } from "$components";

    let {
        isMobile,
        gameMode,
        playerColor,
        opponent,
        difficulty,
        showMoveHighlight,
        drawOffer,
        themeButton,
        backButton,
        onDifficultyChange,
        onNewGame,
        onResign,
        onDrawOffer,
        onToggleMoveHighlight,
    } = $props();
</script>

{#snippet trigger()}
    Menu
{/snippet}

<div class="game-controls">
    <div class="game-info">
        {#if gameMode === "multiplayer"}
            <p>Playing as: <span class="inline-badge">{playerColor}</span></p>
            <p>Opponent: <span class="inline-badge">{opponent}</span></p>
        {/if}
    </div>

    {#if isMobile}
        <Dropdown {trigger}>
            {#if gameMode === "ai"}
                <div class="dropdown-item">
                    <label for="difficulty">AI Difficulty:</label>
                    <select
                        id="difficulty"
                        value={difficulty}
                        onchange={(e) => onDifficultyChange(e.target.value)}
                    >
                        <option value="easy">Easy</option>
                        <option value="medium">Medium</option>
                        <option value="hard">Hard</option>
                    </select>
                </div>
            {/if}

            <button
                class="dropdown-item"
                onclick={onToggleMoveHighlight}
            >
                {showMoveHighlight ? "Hide" : "Show"} Moves
            </button>

            <button
                class="dropdown-item"
                onclick={onNewGame}
            >
                New Game
            </button>

            <button
                class="dropdown-item"
                onclick={onResign}
            >
                Resign
            </button>

            {#if gameMode === "multiplayer"}
                <button
                    class="dropdown-item"
                    onclick={onDrawOffer}
                    disabled={drawOffer !== null}
                >
                    {drawOffer ? "Draw Offered" : "Offer Draw"}
                </button>
            {/if}
            {@render themeButton("dropdown-item")}
            {@render backButton("dropdown-item")}
        </Dropdown>
    {:else}
        <div class="control-group">
            {#if gameMode === "ai"}
                <div class="difficulty-selector">
                    <label for="difficulty" class="difficulty-title">AI Difficulty:</label>
                    <select
                        id="difficulty"
                        value={difficulty}
                        onchange={(e) => onDifficultyChange(e.target.value)}
                    >
                        <option value="easy">Easy</option>
                        <option value="medium">Medium</option>
                        <option value="hard">Hard</option>
                    </select>
                </div>
            {/if}

            <button
                class="ui-button"
                onclick={onToggleMoveHighlight}
            >
                {showMoveHighlight ? "Hide" : "Show"} Moves
            </button>

            <button
                class="ui-button"
                onclick={onNewGame}
            >
                New Game
            </button>

            <button
                class="ui-button"
                onclick={onResign}
            >
                Resign
            </button>

            {#if gameMode === "multiplayer"}
                <button
                    class="ui-button"
                    onclick={onDrawOffer}
                    disabled={drawOffer !== null}
                >
                    {drawOffer ? "Draw Offered" : "Offer Draw"}
                </button>
            {/if}
        </div>
    {/if}
</div>

<style lang="scss">
    .game-controls {
        display: flex;
        gap: $spacing-md;
        align-items: center;
        width: 100%;
        justify-content: space-between;

        .control-group {
            display: flex;
            gap: $spacing-md;
            align-items: center;
            width: 100%;
        }

        button {
            text-wrap: nowrap;
        }

        @media (max-width: $breakpoint-md) {
            flex-direction: column;
            align-items: stretch;
        }
    }

    :global(.dropdown-trigger) {
        margin-left: auto;
    }

    .game-info {
        display: flex;
        gap: $spacing-md;
        flex-wrap: wrap;

        @media (max-width: $breakpoint-md) {
            justify-content: center;
        }

        p {
            display: flex;
            align-items: center;
            gap: $spacing-sm;
            margin: 0;
        }
    }

    :global(.dropdown-items .dropdown-item), .dropdown-item {
        width: 100%;
        text-align: left;
        padding: $spacing-sm $spacing-md;
        background: none;
        border: none;
        color: var(--text-primary);
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: $spacing-sm;

        &:hover {
            background-color: var(--bg-hover);
        }

        &:disabled {
            opacity: 0.5;
            cursor: not-allowed;

            &:hover {
                background: none;
            }
        }

        select {
            margin-left: auto;
        }
    }

    .difficulty-selector {
        display: flex;
        gap: $spacing-sm;
        align-items: center;

        .difficulty-title {
            text-wrap: nowrap;
        }
    }
</style>
